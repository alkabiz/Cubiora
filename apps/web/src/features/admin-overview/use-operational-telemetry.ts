// ─── SCR-ADM-001 · Hook de telemetría operativa bidireccional en tiempo real ──
import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  TELEMETRY_EVENTS,
  type TelemetrySnapshotPayload,
  type CubicleStateChangedPayload,
  type QueueUpdatedPayload,
  type TelemetryPongPayload,
  type TelemetryCubicleState,
  type TelemetryQueuedTicket,
  type TelemetryDailyKpis,
  type TelemetrySlaAlert,
  type BottleneckRecommendation,
} from '@cubiora/shared';
import type {
  CubicleStation,
  QueuedTicket,
  HourlyFlowEntry,
  ConnectionStatus,
  OperationalTelemetryHookResult,
  CubicleStatus,
} from './types';

/** Formatea segundos a formato "MM:ss min" */
export function formatElapsedTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
}

/** Formatea tiempo de ocio para puestos DISPONIBLE */
export function formatIdleTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `Ocio: hace ${m}m ${String(s).padStart(2, '0')}s`;
}

/** Formatea tiempo de espera para la cola */
export function formatWaitTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
}

// ─── Estado inicial honesto (sin mocks ni cifras inventadas) ──────────────────
const INITIAL_EMPTY_KPIS: TelemetryDailyKpis = {
  waitingCount: 0,
  activeCubicles: 0,
  totalCubicles: 0,
  closedTodayCount: 0,
  slaCompliancePercentage: null,
  noShowTodayCount: 0,
  noShowRate: null,
  averageWaitSeconds: null,
  averageServiceSeconds: null,
};

const INITIAL_EMPTY_SLA_ALERT: TelemetrySlaAlert = {
  isActive: false,
  worstCubicleCode: null,
  worstCubicleDisplay: null,
  affectedTicketCode: null,
  elapsedSeconds: null,
  thresholdSeconds: 0,
  slaCompliancePercentage: null,
};

// ─── Helpers de conversión Server → Client ───────────────────────────────────

function mapServerCubicle(serverCub: TelemetryCubicleState): CubicleStation {
  let statusFooterText = 'Estación lista para asignación';
  if (serverCub.visualStatus === 'ATENDIENDO') {
    statusFooterText = 'En rango de SLA nominal';
  } else if (serverCub.visualStatus === 'SLA_EXCEDIDO') {
    statusFooterText = `Umbral superado (>${Math.round(serverCub.slaThresholdSeconds / 60)} min)`;
  } else if (serverCub.visualStatus === 'LLAMANDO') {
    statusFooterText = 'Proyectado en monitor';
  } else if (serverCub.visualStatus === 'INACTIVO') {
    statusFooterText = 'Puesto en mantenimiento programado';
  }

  // Cálculo de segundos transcurridos
  let initialSecs = 0;
  let formattedTime = '00:00 min';

  if (serverCub.visualStatus === 'INACTIVO') {
    formattedTime = 'Fuera de servicio';
  } else if (serverCub.visualStatus === 'DISPONIBLE') {
    if (serverCub.idleSinceAt) {
      initialSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(serverCub.idleSinceAt).getTime()) / 1000),
      );
    }
    formattedTime = formatIdleTime(initialSecs);
  } else if (serverCub.visualStatus === 'LLAMANDO') {
    if (serverCub.calledAt) {
      initialSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(serverCub.calledAt).getTime()) / 1000),
      );
    }
    formattedTime = formatElapsedTime(initialSecs);
  } else {
    // ATENDIENDO o SLA_EXCEDIDO
    if (serverCub.serviceStartedAt) {
      initialSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(serverCub.serviceStartedAt).getTime()) / 1000),
      );
    }
    formattedTime = formatElapsedTime(initialSecs);
  }

  const isFullWidth = serverCub.cubicleCode.endsWith('05') || serverCub.cubicleCode === 'CUB-05';

  return {
    id: serverCub.cubicleCode,
    name: serverCub.displayName,
    moduleCode: (serverCub.moduleCode as 'MOD-A' | 'MOD-B' | 'MOD-C') || 'MOD-A',
    status: serverCub.visualStatus,
    assignedTicket: serverCub.activeTicketPublicCode,
    operatorName: serverCub.operatorDisplayName,
    elapsedSeconds: initialSecs,
    elapsedTimeFormatted: formattedTime,
    statusFooterText,
    dailyProcessedCount: serverCub.dailyCompletedCount,
    fullWidth: isFullWidth,
    startedAtIso: serverCub.serviceStartedAt,
    idleSinceIso: serverCub.idleSinceAt,
    calledAtIso: serverCub.calledAt,
    stateChangedAtIso: serverCub.stateChangedAt,
    slaThresholdSeconds: serverCub.slaThresholdSeconds,
  };
}

function mapServerQueue(serverQueue: TelemetryQueuedTicket[]): QueuedTicket[] {
  return serverQueue.map((t) => {
    const waitingSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(t.issuedAtIso).getTime()) / 1000),
    );
    return {
      position: t.position,
      ticketCode: t.ticketPublicCode,
      priority: t.queueCategory === 'PREFERENTIAL' ? 'PREFERENCIAL' : 'GENERAL',
      issuedAt: t.issuedAtFormatted,
      waitingSeconds,
      issuedAtIso: t.issuedAtIso,
    };
  });
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useOperationalTelemetry(enabled = true): OperationalTelemetryHookResult {
  const [facilityCode, setFacilityCode] = useState<string | null>(null);
  const [facilityName, setFacilityName] = useState<string | null>(null);
  const [slaThresholdSeconds, setSlaThresholdSeconds] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cubicles, setCubicles] = useState<CubicleStation[]>([]);
  const [queue, setQueue] = useState<QueuedTicket[]>([]);
  const [kpis, setKpis] = useState<TelemetryDailyKpis>(INITIAL_EMPTY_KPIS);
  const [slaAlert, setSlaAlert] = useState<TelemetrySlaAlert>(INITIAL_EMPTY_SLA_ALERT);
  const [bottleneckRecommendation, setBottleneckRecommendation] =
    useState<BottleneckRecommendation | null>(null);
  const [hourlyFlow, setHourlyFlow] = useState<HourlyFlowEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'connecting',
  );
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Conexión WebSocket al namespace /operational-telemetry ────────────────
  useEffect(() => {
    if (!enabled) return;

    // Conexión con socket.io
    const socket = io('/operational-telemetry', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      // Medir latencia inmediatamente al conectar
      socket.emit(TELEMETRY_EVENTS.PING, { clientSentAt: Date.now() });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setLatencyMs(null);
    });

    socket.on('connect_error', () => {
      setConnectionStatus('offline');
      setLatencyMs(null);
    });

    // ─── Receptor: Snapshot completo ─────────────────────────────────────────
    socket.on(TELEMETRY_EVENTS.SNAPSHOT, (snapshot: TelemetrySnapshotPayload) => {
      if (snapshot.facilityCode !== undefined) {
        setFacilityCode(snapshot.facilityCode ?? null);
      }
      if (snapshot.facilityName !== undefined) {
        setFacilityName(snapshot.facilityName ?? null);
      }
      const resolvedSla =
        typeof snapshot.slaThresholdSeconds === 'number' && snapshot.slaThresholdSeconds > 0
          ? snapshot.slaThresholdSeconds
          : snapshot.slaAlert?.thresholdSeconds && snapshot.slaAlert.thresholdSeconds > 0
            ? snapshot.slaAlert.thresholdSeconds
            : snapshot.cubicles?.[0]?.slaThresholdSeconds ?? null;
      if (resolvedSla !== null) {
        setSlaThresholdSeconds(resolvedSla);
      }

      if (Array.isArray(snapshot.cubicles)) {
        setCubicles(snapshot.cubicles.map(mapServerCubicle));
      }
      if (Array.isArray(snapshot.queue)) {
        setQueue(mapServerQueue(snapshot.queue));
      }
      if (snapshot.kpis) {
        setKpis(snapshot.kpis);
      }
      if (snapshot.slaAlert) {
        setSlaAlert(snapshot.slaAlert);
      }
      if (snapshot.bottleneckRecommendation !== undefined) {
        setBottleneckRecommendation(snapshot.bottleneckRecommendation ?? null);
      }
      if (Array.isArray(snapshot.hourlyFlow)) {
        const currentHour = `${String(new Date().getHours()).padStart(2, '0')}:00`;
        setHourlyFlow(
          snapshot.hourlyFlow.map((hf) => ({
            hour: hf.hour,
            volume: hf.count,
            isCurrentHour: hf.hour === currentHour,
          })),
        );
      }
      setIsLoaded(true);
      setConnectionStatus('connected');
    });

    // ─── Receptor: Cambio de estado de un cubículo ────────────────────────────
    socket.on(TELEMETRY_EVENTS.CUBICLE_STATE_CHANGED, (payload: CubicleStateChangedPayload) => {
      const updatedStation = mapServerCubicle(payload.cubicle);
      setCubicles((prev) => {
        const index = prev.findIndex((c) => c.id === updatedStation.id);
        if (index === -1) {
          return [...prev, updatedStation];
        }
        const next = [...prev];
        next[index] = updatedStation;
        return next;
      });
    });

    // ─── Receptor: Actualización de cola / KPIs / Alerta SLA ──────────────────
    socket.on(TELEMETRY_EVENTS.QUEUE_UPDATED, (payload: QueueUpdatedPayload) => {
      if (payload.queue) {
        setQueue(mapServerQueue(payload.queue));
      }
      if (payload.kpis) {
        setKpis(payload.kpis);
      }
      if (payload.slaAlert) {
        setSlaAlert(payload.slaAlert);
      }
      if (payload.bottleneckRecommendation !== undefined) {
        setBottleneckRecommendation(payload.bottleneckRecommendation ?? null);
      }
    });

    // ─── Receptor: Pong de latencia ──────────────────────────────────────────
    socket.on(TELEMETRY_EVENTS.PONG, (pong: TelemetryPongPayload) => {
      if (pong?.clientSentAt) {
        const rtt = Math.max(1, Math.round(Date.now() - pong.clientSentAt));
        setLatencyMs(rtt);
      }
    });

    // ─── Intervalo periódico de Ping (cada 10 segundos) ──────────────────────
    pingIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit(TELEMETRY_EVENTS.PING, { clientSentAt: Date.now() });
      }
    }, 10000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  // ─── Ticker local de 1 segundo para interpolación fluida ────────────────────
  const tick = useCallback(() => {
    const nowMs = Date.now();

    // Actualiza contadores de cubículos basados en Date.now() - timestamp del servidor
    setCubicles((prev) =>
      prev.map((c) => {
        if (c.status === 'INACTIVO') return c;

        let totalSecs = c.elapsedSeconds;
        let visualStatus: CubicleStatus = c.status;

        if (c.status === 'DISPONIBLE') {
          if (c.idleSinceIso) {
            totalSecs = Math.max(0, Math.floor((nowMs - new Date(c.idleSinceIso).getTime()) / 1000));
          } else {
            totalSecs += 1;
          }
          return {
            ...c,
            elapsedSeconds: totalSecs,
            elapsedTimeFormatted: formatIdleTime(totalSecs),
          };
        }

        if (c.status === 'LLAMANDO') {
          if (c.calledAtIso) {
            totalSecs = Math.max(0, Math.floor((nowMs - new Date(c.calledAtIso).getTime()) / 1000));
          } else {
            totalSecs += 1;
          }
          return {
            ...c,
            elapsedSeconds: totalSecs,
            elapsedTimeFormatted: formatElapsedTime(totalSecs),
          };
        }

        // ATENDIENDO o SLA_EXCEDIDO
        if (c.startedAtIso) {
          totalSecs = Math.max(0, Math.floor((nowMs - new Date(c.startedAtIso).getTime()) / 1000));
          const threshold = c.slaThresholdSeconds;
          if (threshold && threshold > 0 && totalSecs > threshold && visualStatus === 'ATENDIENDO') {
            visualStatus = 'SLA_EXCEDIDO';
          }
        } else {
          totalSecs += 1;
        }

        return {
          ...c,
          status: visualStatus,
          elapsedSeconds: totalSecs,
          elapsedTimeFormatted: formatElapsedTime(totalSecs),
          statusFooterText:
            visualStatus === 'SLA_EXCEDIDO' && c.slaThresholdSeconds
              ? `Umbral superado (>${Math.round(c.slaThresholdSeconds / 60)} min)`
              : c.statusFooterText,
        };
      }),
    );

    // Actualiza contadores de cola basados en Date.now() - issuedAtIso
    setQueue((prev) =>
      prev.map((t) => {
        let waitingSeconds = t.waitingSeconds;
        if (t.issuedAtIso) {
          waitingSeconds = Math.max(0, Math.floor((nowMs - new Date(t.issuedAtIso).getTime()) / 1000));
        } else {
          waitingSeconds += 1;
        }
        return {
          ...t,
          waitingSeconds,
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [enabled, tick]);

  // ─── Acciones expuestas al consumidor ───────────────────────────────────────

  /** Fuerza solicitud de snapshot al backend */
  const forceRefresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(TELEMETRY_EVENTS.REQUEST_SNAPSHOT, {});
      socketRef.current.emit(TELEMETRY_EVENTS.PING, { clientSentAt: Date.now() });
    }
  }, []);

  /** Envía un aviso general para proyectar en monitores */
  const sendBroadcastNotice = useCallback(
    (message: string, severity: 'info' | 'warning' | 'critical' = 'info'): boolean => {
      const trimmed = message.trim();
      if (!trimmed || !socketRef.current?.connected) {
        return false;
      }
      socketRef.current.emit(TELEMETRY_EVENTS.BROADCAST_NOTICE, { message: trimmed, severity });
      return true;
    },
    [],
  );

  return {
    facilityCode,
    facilityName,
    slaThresholdSeconds,
    isLoaded,
    cubicles,
    queue,
    kpis,
    slaAlert,
    bottleneckRecommendation,
    hourlyFlow,
    connectionStatus,
    latencyMs,
    forceRefresh,
    sendBroadcastNotice,
  };
}
