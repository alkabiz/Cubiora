import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CubicleActiveTicket, CubicleSnapshot, TicketStatus } from '@cubiora/shared';
import { ApiClientError, apiClient } from '../../lib/api';
import type {
  CubicleCommand,
  CubicleOutcome,
  CubicleVisualStep,
  CubicleWorkspace,
  UseCubicleWorkspaceOptions,
} from './types';
import { deriveStableViewStep, getServerClockOffsetMs } from './cubicle-view-model';

const DEFAULT_POLL_INTERVAL_MS = 7000;

const CONFLICT_MESSAGE =
  'El estado del turno fue actualizado por otro operador o proceso concurrente. Se ha sincronizado el cubículo con el estado vigente.';

const CONFLICT_SYNC_FAILED_MESSAGE =
  'El turno fue modificado por otro operador y no fue posible sincronizar el cubículo. Verifica la conexión antes de continuar.';

let requestSequence = 0;

/**
 * Genera un identificador de petición sin Math.random.
 * crypto.randomUUID es la vía principal; getRandomValues cubre navegadores
 * antiguos y el último fallback solo evita ejecutar la acción sin trazabilidad.
 */
function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    requestSequence += 1;
    const seed = `${Date.now()}-${requestSequence}-${performance.now()}`;
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = seed.charCodeAt(index % seed.length) ^ (index * 31);
    }
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function extractCubicleNumber(code: string | undefined, displayName: string | undefined): string {
  const digits = displayName?.match(/\d+/)?.[0] ?? code?.match(/\d+/)?.[0] ?? '';
  return digits ? digits.padStart(2, '0') : '—';
}

function canExecute(command: CubicleCommand, ticket: CubicleActiveTicket): boolean {
  if (command === 'call') {
    return ticket.status === TicketStatus.ASSIGNED || ticket.status === TicketStatus.CALLED;
  }
  if (command === 'start-service' || command === 'no-show') {
    return ticket.status === TicketStatus.CALLED;
  }
  return ticket.status === TicketStatus.IN_SERVICE;
}

/** Una petición que no obtuvo respuesta HTTP es una falla de red. */
function isNetworkFailure(error: unknown): boolean {
  return !(error instanceof ApiClientError);
}

/**
 * Un 5xx o una pérdida de red deja la mutación en resultado incierto.
 * Los 4xx, salvo 409, son rechazos explícitos y no se tratan como ambiguos.
 */
function isAmbiguousMutationFailure(error: unknown): boolean {
  return !(error instanceof ApiClientError) || error.statusCode >= 500;
}

/**
 * Encapsula la integración real de SCR-CAJ-001.
 *
 * - El snapshot del cubículo es la única fuente de verdad del estado persistido.
 * - Los comandos no modifican el turno localmente antes de la respuesta de la API.
 * - Una respuesta ambigua se presenta como UNCERTAIN_RESULT y exige
 *   reconciliación explícita antes de habilitar un nuevo intento.
 */
export function useCubicleWorkspace({
  cubicleCode,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseCubicleWorkspaceOptions): CubicleWorkspace {
  const [snapshot, setSnapshot] = useState<CubicleSnapshot | null>(null);
  const [outcome, setOutcome] = useState<CubicleOutcome | null>(null);
  const [pendingAction, setPendingAction] = useState<CubicleCommand | null>(null);
  const [confirmAction, setConfirmActionState] = useState<'close' | 'no-show' | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnlineState] = useState(true);
  const [isReconciling, setIsReconcilingState] = useState(false);
  const [isUncertain, setIsUncertainState] = useState(false);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const snapshotRef = useRef<CubicleSnapshot | null>(null);
  const isPendingRef = useRef(false);
  const isOnlineRef = useRef(true);
  const isReconcilingRef = useRef(false);
  const isUncertainRef = useRef(false);
  const confirmActionRef = useRef<'close' | 'no-show' | null>(null);
  const attemptRef = useRef<{ command: CubicleCommand; idempotencyKey: string } | null>(null);
  const snapshotRequestIdRef = useRef(0);
  const requestEpochRef = useRef(0);

  const activeTicket = snapshot?.activeTicket ?? null;

  const setOnline = useCallback((value: boolean) => {
    isOnlineRef.current = value;
    setIsOnlineState(value);
  }, []);

  const setReconciling = useCallback((value: boolean) => {
    isReconcilingRef.current = value;
    setIsReconcilingState(value);
  }, []);

  const setUncertain = useCallback((value: boolean) => {
    isUncertainRef.current = value;
    setIsUncertainState(value);
  }, []);

  const setConfirmAction = useCallback((value: 'close' | 'no-show' | null) => {
    confirmActionRef.current = value;
    setConfirmActionState(value);
  }, []);

  const applySnapshot = useCallback(
    (nextSnapshot: CubicleSnapshot) => {
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setServerClockOffsetMs(getServerClockOffsetMs(nextSnapshot.serverTime));
      setOnline(true);
      setSyncError(null);

      // Conciliar el resultado visual con el estado vigente sin inventar transiciones.
      setOutcome((previous) => {
        if (!previous) return previous;

        const nextTicket = nextSnapshot.activeTicket;

        if (!nextTicket) {
          // Un cierre sin siguiente conserva su confirmación visual.
          // Una inasistencia sin siguiente vuelve al estado disponible.
          return previous.type === 'CLOSED' ? previous : null;
        }

        // Si el cierre/inasistencia no tenía siguiente y después aparece un turno,
        // se trata como una asignación normal proveniente de la cola.
        if (!previous.hadNext) return null;

        // El siguiente turno continúa asignado: se conserva el estado posterior.
        if (nextTicket.status === TicketStatus.ASSIGNED) return previous;

        // Otro actor avanzó el turno: manda el estado persistido.
        return null;
      });
    },
    [setOnline],
  );

  const loadSnapshot = useCallback(
    async (options: { silent?: boolean } = {}): Promise<CubicleSnapshot | null> => {
      const requestEpoch = requestEpochRef.current;
      snapshotRequestIdRef.current += 1;
      const requestId = snapshotRequestIdRef.current;

      if (!options.silent) {
        setIsRefreshing(true);
      }

      try {
        const response = await apiClient<{ success: boolean; data: CubicleSnapshot }>(
          `/cubicles/${encodeURIComponent(cubicleCode)}/current`,
        );

        if (
          requestId !== snapshotRequestIdRef.current ||
          requestEpoch !== requestEpochRef.current
        ) {
          return null;
        }

        applySnapshot(response.data);
        return response.data;
      } catch (error) {
        if (
          requestId === snapshotRequestIdRef.current &&
          requestEpoch === requestEpochRef.current
        ) {
          // Un error HTTP demuestra que hay comunicación; una falla de fetch no.
          setOnline(!isNetworkFailure(error));
          setSyncError(
            error instanceof Error
              ? error.message
              : 'No fue posible consultar el estado del cubículo.',
          );
        }
        return null;
      } finally {
        if (requestId === snapshotRequestIdRef.current) {
          setIsInitialLoading(false);
          if (!options.silent) {
            setIsRefreshing(false);
          }
        }
      }
    },
    [applySnapshot, cubicleCode, setOnline],
  );

  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);

    const handleOffline = () => setOnline(false);
    const handleOnline = () => setOnline(true);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [setOnline]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (isPendingRef.current || confirmAction !== null) return;
      if (isUncertain || isReconciling) return;
      if (document.visibilityState === 'hidden') return;
      void loadSnapshot({ silent: true });
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [confirmAction, isReconciling, isUncertain, loadSnapshot, pollIntervalMs]);

  const step = useMemo<CubicleVisualStep>(() => {
    if (isReconciling) return 'RECONCILING';
    if (isUncertain) return 'UNCERTAIN_RESULT';

    if (pendingAction === 'call') return 'PROCESSING_CALL';
    if (pendingAction === 'start-service') return 'PROCESSING_START';
    if (pendingAction === 'close') return 'PROCESSING_CLOSE';
    if (pendingAction === 'no-show') return 'PROCESSING_NO_SHOW';

    if (confirmAction === 'close') return 'CONFIRM_CLOSE';
    if (confirmAction === 'no-show') return 'CONFIRM_NO_SHOW';

    if (outcome) {
      if (outcome.type === 'CLOSED') {
        return activeTicket ? 'CLOSED_NEXT' : 'CLOSED_NO_NEXT';
      }
      return activeTicket ? 'NO_SHOW_NEXT' : 'AVAILABLE';
    }

    if (!snapshot) {
      return isInitialLoading ? 'INITIAL_LOADING' : 'OFFLINE';
    }

    return deriveStableViewStep(snapshot);
  }, [
    activeTicket,
    confirmAction,
    isInitialLoading,
    isReconciling,
    isUncertain,
    outcome,
    pendingAction,
    snapshot,
  ]);

  const executeCommand = useCallback(
    async (command: CubicleCommand) => {
      if (!isOnlineRef.current || isUncertainRef.current || isReconcilingRef.current) return;

      const currentSnapshot = snapshotRef.current;
      const ticket = currentSnapshot?.activeTicket ?? null;

      if (!ticket || isPendingRef.current || !canExecute(command, ticket)) return;

      isPendingRef.current = true;
      setPendingAction(command);
      setActionError(null);

      requestEpochRef.current += 1;
      const requestEpoch = requestEpochRef.current;
      const idempotencyKey = createRequestId();
      const correlationId = createRequestId();
      attemptRef.current = { command, idempotencyKey };

      try {
        const response = await apiClient<{ success: boolean; data: CubicleSnapshot }>(
          `/tickets/${encodeURIComponent(ticket.publicId)}/${command}`,
          {
            method: 'POST',
            headers: {
              'Idempotency-Key': idempotencyKey,
              'X-Correlation-ID': correlationId,
              'expected-version': String(ticket.version),
              'If-Match': String(ticket.version),
            },
            body: JSON.stringify({ expectedVersion: ticket.version }),
          },
        );

        if (requestEpochRef.current !== requestEpoch) return;

        applySnapshot(response.data);

        if (command === 'close') {
          setOutcome({
            type: 'CLOSED',
            finishedCode: ticket.publicCode,
            hadNext: response.data.activeTicket !== null,
          });
        } else if (command === 'no-show') {
          setOutcome({
            type: 'NO_SHOW',
            finishedCode: ticket.publicCode,
            hadNext: response.data.activeTicket !== null,
          });
        } else {
          setOutcome(null);
        }
      } catch (error) {
        if (requestEpochRef.current !== requestEpoch) return;

        if (error instanceof ApiClientError && error.statusCode === 409) {
          // 409 es un rechazo definitivo: se consulta el snapshot y se
          // representa el estado real antes de permitir otro intento.
          const freshSnapshot = await loadSnapshot({ silent: true });

          if (requestEpochRef.current !== requestEpoch) return;

          setActionError(freshSnapshot ? CONFLICT_MESSAGE : CONFLICT_SYNC_FAILED_MESSAGE);
          return;
        }

        if (isAmbiguousMutationFailure(error)) {
          // No se consulta automáticamente y no se repite el comando:
          // la persona operadora debe solicitar la reconciliación explícita.
          setUncertain(true);
          setActionError(null);

          if (isNetworkFailure(error)) {
            setOnline(false);
          }
          return;
        }

        setActionError(
          error instanceof Error
            ? error.message
            : 'No fue posible completar la operación en el servidor.',
        );
      } finally {
        if (requestEpochRef.current === requestEpoch) {
          isPendingRef.current = false;
          setPendingAction(null);
          setConfirmAction(null);
          attemptRef.current = null;
        }
      }
    },
    [applySnapshot, loadSnapshot, setConfirmAction, setOnline, setUncertain],
  );

  const requestCall = useCallback(() => executeCommand('call'), [executeCommand]);
  const requestStartService = useCallback(() => executeCommand('start-service'), [executeCommand]);

  const requestClose = useCallback(() => {
    if (isPendingRef.current || isUncertainRef.current || !isOnlineRef.current) return;
    const ticket = snapshotRef.current?.activeTicket;
    if (!ticket || !canExecute('close', ticket)) return;

    setActionError(null);
    setConfirmAction('close');
  }, [setConfirmAction]);

  const cancelClose = useCallback(() => {
    if (isPendingRef.current) return;
    if (confirmActionRef.current === 'close') setConfirmAction(null);
  }, [setConfirmAction]);

  const confirmClose = useCallback(() => executeCommand('close'), [executeCommand]);

  const requestNoShow = useCallback(() => {
    if (isPendingRef.current || isUncertainRef.current || !isOnlineRef.current) return;
    const ticket = snapshotRef.current?.activeTicket;
    if (!ticket || !canExecute('no-show', ticket)) return;

    setActionError(null);
    setConfirmAction('no-show');
  }, [setConfirmAction]);

  const cancelNoShow = useCallback(() => {
    if (isPendingRef.current) return;
    if (confirmActionRef.current === 'no-show') setConfirmAction(null);
  }, [setConfirmAction]);

  const confirmNoShow = useCallback(() => executeCommand('no-show'), [executeCommand]);

  const refresh = useCallback(async () => {
    if (isPendingRef.current) return;

    const freshSnapshot = await loadSnapshot();

    // Una actualización manual de un cierre sin siguiente devuelve la tarjeta
    // a AVAILABLE. El sondeo silencioso conserva la confirmación visual.
    if (freshSnapshot && !freshSnapshot.activeTicket) {
      setOutcome(null);
    }
  }, [loadSnapshot]);

  const reconcile = useCallback(async () => {
    if (isPendingRef.current || isReconcilingRef.current) return;

    setReconciling(true);
    setActionError(null);

    try {
      const freshSnapshot = await loadSnapshot();

      if (freshSnapshot) {
        // La reconciliación reemplaza el snapshot, pero no reproduce el
        // comando anterior ni afirma que esa operación haya sido la causa.
        setOutcome(null);
        setUncertain(false);
      }
    } finally {
      setReconciling(false);
    }
  }, [loadSnapshot, setReconciling, setUncertain]);

  return {
    cubicleCode,
    displayName: snapshot?.cubicle.displayName || snapshot?.cubicle.code || 'Cubículo',
    cubicleNumber: extractCubicleNumber(snapshot?.cubicle.code, snapshot?.cubicle.displayName),
    snapshot,
    activeTicket,
    step,
    pendingAction,
    outcome,
    isInitialLoading,
    isRefreshing,
    isOnline,
    isReconciling,
    isUncertain,
    actionsDisabled: !isOnline || isReconciling || isUncertain || pendingAction !== null,
    serverClockOffsetMs,
    waitingCount: snapshot?.waitingCount ?? 0,
    actionError,
    syncError,
    requestCall,
    requestStartService,
    requestClose,
    cancelClose,
    confirmClose,
    requestNoShow,
    cancelNoShow,
    confirmNoShow,
    refresh,
    reconcile,
  };
}
