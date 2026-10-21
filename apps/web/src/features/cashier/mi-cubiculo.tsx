import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from '@radix-ui/themes';
import {
  ArrowRightIcon,
  CheckCircledIcon,
  CheckIcon,
  ClockIcon,
  Cross2Icon,
  ExclamationTriangleIcon,
  PersonIcon,
  PlayIcon,
  ReloadIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import type { CubicleActiveTicket } from '@cubiora/shared';
import type { CubicleVisualStep, CubicleWorkspace } from './types';
import { formatClockTime, formatDuration, waitingPatientsLabel } from './cubicle-view-model';

export interface MiCubiculoProps {
  workspace: CubicleWorkspace;
  className?: string;
}

type BadgeTone = 'green' | 'amber' | 'violet' | 'blue' | 'red' | 'slate';

interface BadgeConfig {
  label: string;
  tone: BadgeTone;
  pulse?: boolean;
  spinner?: boolean;
}

const BADGE_CONFIG: Record<CubicleVisualStep, BadgeConfig> = {
  INITIAL_LOADING: { label: 'Sincronizando', tone: 'slate', spinner: true },
  AVAILABLE: { label: 'Disponible', tone: 'green' },
  ASSIGNED: { label: 'Turno asignado', tone: 'amber' },
  PROCESSING_CALL: { label: 'Procesando', tone: 'blue', spinner: true },
  CALLED: { label: 'Llamado', tone: 'violet', pulse: true },
  PROCESSING_START: { label: 'Procesando', tone: 'blue', spinner: true },
  IN_SERVICE: { label: 'En atención', tone: 'blue' },
  CONFIRM_CLOSE: { label: 'En atención', tone: 'blue' },
  PROCESSING_CLOSE: { label: 'Procesando', tone: 'blue', spinner: true },
  CLOSED_NEXT: { label: 'Turno asignado', tone: 'amber' },
  CLOSED_NO_NEXT: { label: 'Disponible', tone: 'green' },
  CONFIRM_NO_SHOW: { label: 'Llamado', tone: 'violet', pulse: true },
  PROCESSING_NO_SHOW: { label: 'Procesando', tone: 'blue', spinner: true },
  NO_SHOW_NEXT: { label: 'Turno asignado', tone: 'amber' },
  UNCERTAIN_RESULT: { label: 'Resultado incierto', tone: 'red' },
  OFFLINE: { label: 'Sin conexión', tone: 'red' },
  RECONCILING: { label: 'Verificando', tone: 'blue', spinner: true },
};

const BADGE_TONES: Record<BadgeTone, string> = {
  green: 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]',
  amber: 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]',
  violet: 'bg-[#F5F3FF] border-[#DDD6FE] text-[#5B21B6]',
  blue: 'bg-[#EFF4FF] border-[#C9E6FF] text-[#006591]',
  red: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
  slate: 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]',
};

const DOT_TONES: Record<BadgeTone, string> = {
  green: 'bg-[#10B981]',
  amber: 'bg-[#F59E0B]',
  violet: 'bg-[#8B5CF6]',
  blue: 'bg-[#0EA5E9]',
  red: 'bg-[#EF4444]',
  slate: 'bg-[#94A3B8]',
};

const PRIMARY_BUTTON =
  'inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#0F2942] hover:bg-[#0A1B2C] text-white font-bold text-sm transition-colors cursor-pointer shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-60';

const PRIMARY_BLUE_BUTTON =
  'inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#0369A1] hover:bg-[#075985] text-white font-bold text-sm transition-colors cursor-pointer shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F2942] disabled:cursor-not-allowed disabled:opacity-60';

const SECONDARY_BUTTON =
  'inline-flex w-full sm:w-auto items-center justify-center gap-2 px-3.5 py-2 rounded text-xs font-semibold text-[#0F2942] bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-60';

const DANGER_BUTTON =
  'inline-flex w-full sm:w-auto items-center justify-center gap-2 px-3.5 py-2 rounded text-xs font-semibold text-[#BA1A1A] hover:bg-[#FFDAD6]/30 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA1A1A] disabled:cursor-not-allowed disabled:opacity-60';

function StatusBadge({ step }: { step: CubicleVisualStep }) {
  const config = BADGE_CONFIG[step];

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-bold uppercase tracking-wider ${BADGE_TONES[config.tone]}`}
    >
      {config.spinner ? (
        <UpdateIcon className="w-3 h-3 animate-spin" aria-hidden="true" />
      ) : (
        <span
          className={`w-2 h-2 rounded-full ${DOT_TONES[config.tone]} ${config.pulse ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
    </span>
  );
}

interface TicketSummaryProps {
  ticket: CubicleActiveTicket;
  tone: 'neutral' | 'called' | 'service';
  label: string;
  timestamp: 'assigned' | 'called' | 'service';
  timer?: string;
  timerPrefix?: string;
  className?: string;
}

const TICKET_TONES = {
  neutral: {
    panel: 'bg-[#F8FAFC] border-[#E2E8F0]',
    label: 'text-[#64748B]',
    chip: 'text-[#475569] border-[#E2E8F0]',
  },
  called: {
    panel: 'bg-[#F5F3FF]/40 border-[#DDD6FE]',
    label: 'text-[#5B21B6]',
    chip: 'text-[#5B21B6] border-[#DDD6FE]',
  },
  service: {
    panel: 'bg-[#EFF4FF]/50 border-[#C9E6FF]',
    label: 'text-[#006591]',
    chip: 'text-[#006591] border-[#C9E6FF]',
  },
} as const;

function TicketSummary({
  ticket,
  tone,
  label,
  timestamp,
  timer,
  timerPrefix,
  className = '',
}: TicketSummaryProps) {
  const styles = TICKET_TONES[tone];

  const timestampText =
    timestamp === 'assigned'
      ? `Asignado a las ${formatClockTime(ticket.assignedAt)}`
      : timestamp === 'called'
        ? `Llamado a las ${formatClockTime(ticket.calledAt)}`
        : `Inicio a las ${formatClockTime(ticket.serviceStartedAt)}`;

  return (
    <div className={`p-4 rounded-lg border space-y-2 ${styles.panel} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`text-xs font-semibold ${styles.label}`}>
          {label}
          {ticket.callNumber > 1 && (
            <span className="ml-1 font-normal opacity-80">· Llamado #{ticket.callNumber}</span>
          )}
        </div>

        {timer && (
          <div
            className={`font-mono text-xs font-bold bg-white px-2.5 py-1 rounded border flex items-center gap-1.5 ${styles.chip}`}
          >
            <ClockIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {timerPrefix ? `${timerPrefix} ` : ''}
              {timer}
            </span>
          </div>
        )}
      </div>

      <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider break-all">
        {ticket.publicCode}
      </div>

      <div className="space-y-1">
        <div className="text-sm font-bold text-[#0F2942] flex items-center gap-1.5">
          <PersonIcon className="w-3.5 h-3.5 text-[#64748B] shrink-0" aria-hidden="true" />
          <span>{ticket.patientName}</span>
        </div>

        {ticket.maskedDocument && (
          <div className="text-xs text-[#64748B]">
            Documento <span className="font-mono">{ticket.maskedDocument}</span>
          </div>
        )}
      </div>

      <div className="text-xs text-[#64748B] pt-1">
        <div>{timestampText}</div>
      </div>
    </div>
  );
}

function WaitingCounter({ count, className = '' }: { count: number; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 text-xs font-medium text-[#64748B] ${className}`}
    >
      <PersonIcon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{waitingPatientsLabel(count)}</span>
    </div>
  );
}

function SuccessNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs flex items-start gap-2">
      <CheckCircledIcon className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" aria-hidden="true" />
      <span className="font-medium leading-relaxed">{children}</span>
    </div>
  );
}

function WarningNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs flex items-start gap-2">
      <Cross2Icon className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" aria-hidden="true" />
      <span className="font-medium leading-relaxed">{children}</span>
    </div>
  );
}

function OfflineBanner({ workspace }: { workspace: CubicleWorkspace }) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
    >
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <div className="text-xs font-bold">Sin conexión</div>
          <p className="text-xs leading-relaxed">
            Cubiora no puede confirmar cambios en este momento.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void workspace.refresh()}
        disabled={workspace.isRefreshing}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-[#FDE68A] bg-white font-semibold text-[#92400E] hover:bg-[#FEF3C7] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      >
        {workspace.isRefreshing ? (
          <UpdateIcon className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ReloadIcon className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        Verificar conexión
      </button>
    </div>
  );
}

/**
 * CMP-SCR-CAJ-001 · Mi Cubículo
 *
 * Presentación del flujo operativo de ventanilla. Toda la información
 * transaccional proviene de CubicleWorkspace; este componente no simula
 * transiciones ni mantiene turnos de ejemplo.
 */
export const MiCubiculo: React.FC<MiCubiculoProps> = ({ workspace, className = '' }) => {
  const { step, activeTicket, outcome } = workspace;
  const [clientNow, setClientNow] = useState(() => Date.now());

  const closeTriggerRef = useRef<HTMLButtonElement>(null);
  const noShowTriggerRef = useRef<HTMLButtonElement>(null);
  const closeCancelRef = useRef<HTMLButtonElement>(null);
  const noShowCancelRef = useRef<HTMLButtonElement>(null);

  const hasCallTimer = Boolean(activeTicket?.calledAt) && activeTicket?.status === 'CALLED';
  const hasServiceTimer =
    Boolean(activeTicket?.serviceStartedAt) && activeTicket?.status === 'IN_SERVICE';

  useEffect(() => {
    if (!hasCallTimer && !hasServiceTimer) return;

    setClientNow(Date.now());
    const interval = window.setInterval(() => setClientNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTicket?.id, hasCallTimer, hasServiceTimer]);

  // La hora de referencia es la del servidor. El offset evita que un reloj
  // local desfasado altere la duración mostrada y se recalcula en cada snapshot.
  const serverNow = clientNow + workspace.serverClockOffsetMs;
  const callTimer = activeTicket?.calledAt
    ? formatDuration(activeTicket.calledAt, serverNow)
    : undefined;
  const serviceTimer = activeTicket?.serviceStartedAt
    ? formatDuration(activeTicket.serviceStartedAt, serverNow)
    : undefined;

  const isProcessing =
    step === 'PROCESSING_CALL' ||
    step === 'PROCESSING_START' ||
    step === 'PROCESSING_CLOSE' ||
    step === 'PROCESSING_NO_SHOW';
  const closeModalOpen = step === 'CONFIRM_CLOSE' || step === 'PROCESSING_CLOSE';
  const noShowModalOpen = step === 'CONFIRM_NO_SHOW' || step === 'PROCESSING_NO_SHOW';
  const isClosing = step === 'PROCESSING_CLOSE';
  const isMarkingNoShow = step === 'PROCESSING_NO_SHOW';

  const closeModal = (
    <Dialog.Root
      open={closeModalOpen}
      onOpenChange={(open) => {
        if (!open && !isClosing) workspace.cancelClose();
      }}
    >
      <Dialog.Content
        size="2"
        className="max-w-[480px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-ticket-title"
        aria-busy={isClosing}
        onEscapeKeyDown={(event) => {
          if (isClosing) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isClosing) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeCancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          closeTriggerRef.current?.focus();
        }}
      >
        <Dialog.Title id="close-ticket-title" className="text-base font-bold text-[#0F2942]">
          ¿Cerrar el turno {activeTicket?.publicCode ?? '—'}?
        </Dialog.Title>
        <Dialog.Description size="2" className="mt-2 text-[#475569]">
          Se finalizará la atención y el {workspace.displayName} quedará disponible para recibir el
          siguiente turno.
        </Dialog.Description>

        {isClosing && (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg border border-[#C9E6FF] bg-[#EFF4FF] p-3 text-xs font-semibold text-[#006591]"
            aria-live="polite"
          >
            <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
            Cerrando turno y liberando cubículo…
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-end gap-2 text-xs">
          <button
            ref={closeCancelRef}
            type="button"
            onClick={workspace.cancelClose}
            disabled={isClosing}
            className={SECONDARY_BUTTON}
          >
            Continuar atención
          </button>
          <button
            type="button"
            onClick={() => void workspace.confirmClose()}
            disabled={isClosing || !workspace.isOnline}
            className={PRIMARY_BUTTON}
          >
            {isClosing ? (
              <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckIcon className="w-4 h-4" aria-hidden="true" />
            )}
            Cerrar turno y liberar cubículo
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );

  const noShowModal = (
    <Dialog.Root
      open={noShowModalOpen}
      onOpenChange={(open) => {
        if (!open && !isMarkingNoShow) workspace.cancelNoShow();
      }}
    >
      <Dialog.Content
        size="2"
        className="max-w-[480px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="no-show-ticket-title"
        aria-busy={isMarkingNoShow}
        onEscapeKeyDown={(event) => {
          if (isMarkingNoShow) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isMarkingNoShow) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          noShowCancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          noShowTriggerRef.current?.focus();
        }}
      >
        <Dialog.Title id="no-show-ticket-title" className="text-base font-bold text-[#0F2942]">
          ¿Registrar el turno {activeTicket?.publicCode ?? '—'} como no presentado?
        </Dialog.Title>
        <Dialog.Description size="2" className="mt-2 text-[#475569]">
          El cubículo quedará disponible para recibir al siguiente paciente.
        </Dialog.Description>

        {isMarkingNoShow && (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#991B1B]"
            aria-live="polite"
          >
            <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
            Marcando como no presentado…
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-end gap-2 text-xs">
          <button
            ref={noShowCancelRef}
            type="button"
            onClick={workspace.cancelNoShow}
            disabled={isMarkingNoShow}
            className={SECONDARY_BUTTON}
          >
            Volver al turno
          </button>
          <button
            type="button"
            onClick={() => void workspace.confirmNoShow()}
            disabled={isMarkingNoShow || !workspace.isOnline}
            className={`${PRIMARY_BUTTON} !bg-[#BA1A1A] hover:!bg-[#93000A]`}
          >
            {isMarkingNoShow ? (
              <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Cross2Icon className="w-4 h-4" aria-hidden="true" />
            )}
            Marcar como no presentado
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );

  const renderBody = (): React.ReactNode => {
    switch (step) {
      case 'INITIAL_LOADING':
        return (
          <div className="py-10 text-center space-y-3" aria-live="polite">
            <UpdateIcon
              className="w-7 h-7 animate-spin text-[#0EA5E9] mx-auto"
              aria-hidden="true"
            />
            <div className="text-base font-bold text-[#0F2942]">
              Sincronizando estado del cubículo…
            </div>
            <p className="text-xs text-[#64748B]">
              Consultando el turno activo y la versión vigente del servidor.
            </p>
          </div>
        );

      case 'OFFLINE':
        return (
          <div className="py-8 text-center space-y-4" role="alert">
            <ExclamationTriangleIcon
              className="w-8 h-8 text-[#D97706] mx-auto"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <div className="text-base font-bold text-[#0F2942]">Sin conexión</div>
              <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                Cubiora no puede confirmar cambios en este momento.
              </p>
              {workspace.syncError && (
                <p className="text-[11px] text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                  {workspace.syncError}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void workspace.refresh()}
              disabled={workspace.isRefreshing}
              className={PRIMARY_BUTTON}
            >
              {workspace.isRefreshing ? (
                <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <ReloadIcon className="w-4 h-4" aria-hidden="true" />
              )}
              Verificar conexión
            </button>
          </div>
        );

      case 'UNCERTAIN_RESULT':
        return (
          <div className="py-8 text-center space-y-4" role="alert">
            <ExclamationTriangleIcon
              className="w-8 h-8 text-[#D97706] mx-auto"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <div className="text-base font-bold text-[#0F2942]">
                No pudimos confirmar la operación.
              </div>
              <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                Cubiora verificará el estado actual antes de permitir otro intento.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void workspace.reconcile()}
              disabled={workspace.isReconciling}
              className={PRIMARY_BUTTON}
            >
              {workspace.isReconciling ? (
                <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <ReloadIcon className="w-4 h-4" aria-hidden="true" />
              )}
              Verificar estado actual
            </button>
          </div>
        );

      case 'RECONCILING':
        return (
          <div className="py-10 text-center space-y-4" aria-live="polite">
            <UpdateIcon
              className="w-8 h-8 animate-spin text-[#0EA5E9] mx-auto"
              aria-hidden="true"
            />
            <div className="text-base font-bold text-[#0F2942]">Verificando estado actual…</div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Consultando el snapshot vigente del cubículo. No se repetirá el comando anterior.
            </p>
          </div>
        );

      case 'AVAILABLE':
        return (
          <div className="space-y-5">
            {outcome?.type === 'NO_SHOW' && (
              <WarningNotice>
                Turno <strong>{outcome.finishedCode}</strong> marcado como no presentado.
              </WarningNotice>
            )}

            <div className="py-8 text-center space-y-2">
              <div className="text-base sm:text-lg font-semibold text-[#0F2942]">
                Esperando el siguiente turno
              </div>
              <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                El próximo turno se asignará automáticamente
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <WaitingCounter count={workspace.waitingCount} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#64748B]">
                <span
                  className={`w-2 h-2 rounded-full ${workspace.isOnline ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`}
                  aria-hidden="true"
                />
                {workspace.isOnline
                  ? 'Sincronización automática activa'
                  : 'Sin conexión. Verifica para continuar.'}
              </div>

              <button
                type="button"
                onClick={() => void workspace.refresh()}
                disabled={workspace.isRefreshing || isProcessing}
                className={SECONDARY_BUTTON}
              >
                {workspace.isRefreshing ? (
                  <UpdateIcon className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ReloadIcon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Actualizar estado
              </button>
            </div>
          </div>
        );

      case 'ASSIGNED':
      case 'PROCESSING_CALL': {
        if (!activeTicket) return null;
        const isCalling = step === 'PROCESSING_CALL';

        return (
          <div className="space-y-6">
            <TicketSummary
              ticket={activeTicket}
              tone="neutral"
              label="Número de turno"
              timestamp="assigned"
              className={isCalling ? 'opacity-90' : ''}
            />

            <WaitingCounter count={workspace.waitingCount} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => void workspace.requestCall()}
                disabled={isCalling || workspace.actionsDisabled}
                aria-busy={isCalling}
                className={PRIMARY_BUTTON}
              >
                {isCalling ? (
                  <>
                    <UpdateIcon
                      className="w-4 h-4 animate-spin text-[#38BDF8]"
                      aria-hidden="true"
                    />
                    Llamando turno…
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4" aria-hidden="true" />
                    Llamar turno
                  </>
                )}
              </button>

              <div className="text-xs text-[#64748B]">
                El llamado se registra en el servidor y se anuncia en sala.
              </div>
            </div>
          </div>
        );
      }

      case 'CALLED':
      case 'PROCESSING_START':
      case 'CONFIRM_NO_SHOW': {
        if (!activeTicket) return null;
        const isStarting = step === 'PROCESSING_START';
        const isConfirming = step === 'CONFIRM_NO_SHOW';

        const content = (
          <div className="space-y-6">
            <TicketSummary
              ticket={activeTicket}
              tone="called"
              label="Número de turno"
              timestamp="called"
              timer={callTimer}
              timerPrefix="Tiempo desde el llamado:"
              className={isStarting ? 'opacity-90' : ''}
            />

            <WaitingCounter count={workspace.waitingCount} />

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => void workspace.requestStartService()}
                disabled={isStarting || isConfirming || workspace.actionsDisabled}
                aria-busy={isStarting}
                className={PRIMARY_BLUE_BUTTON}
              >
                {isStarting ? (
                  <>
                    <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Iniciando atención…
                  </>
                ) : (
                  <>
                    <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                    Iniciar atención
                  </>
                )}
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void workspace.requestCall()}
                    disabled={isStarting || isConfirming || workspace.actionsDisabled}
                    className={SECONDARY_BUTTON}
                  >
                    <ReloadIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    Repetir llamado
                  </button>

                  <button
                    ref={noShowTriggerRef}
                    type="button"
                    onClick={workspace.requestNoShow}
                    disabled={isStarting || isConfirming || workspace.actionsDisabled}
                    className={DANGER_BUTTON}
                  >
                    <Cross2Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    Paciente no presentado
                  </button>
                </div>

                <div className="text-xs text-[#64748B]">
                  El turno permanece en estado llamado hasta iniciar la atención.
                </div>
              </div>
            </div>
          </div>
        );

        if (!isConfirming) return content;

        return (
          <div aria-hidden="true" className="pointer-events-none opacity-40">
            {content}
          </div>
        );
      }

      case 'IN_SERVICE':
      case 'CONFIRM_CLOSE':
      case 'PROCESSING_CLOSE': {
        if (!activeTicket) return null;
        const isConfirming = step === 'CONFIRM_CLOSE';
        const isProcessingClose = step === 'PROCESSING_CLOSE';

        const content = (
          <div className="space-y-6">
            <TicketSummary
              ticket={activeTicket}
              tone="service"
              label="Número de turno"
              timestamp="service"
              timer={serviceTimer}
              timerPrefix="Duración:"
            />

            <WaitingCounter count={workspace.waitingCount} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <button
                ref={closeTriggerRef}
                type="button"
                onClick={workspace.requestClose}
                disabled={isConfirming || isProcessingClose || workspace.actionsDisabled}
                className={PRIMARY_BUTTON}
              >
                <CheckIcon className="w-4 h-4" aria-hidden="true" />
                Cerrar turno
              </button>

              <div className="text-xs text-[#64748B]">
                El cierre registra la finalización y libera el cubículo en una sola operación.
              </div>
            </div>
          </div>
        );

        if (!isConfirming && !isProcessingClose) return content;

        return (
          <div aria-hidden="true" className="pointer-events-none opacity-40">
            {content}
          </div>
        );
      }

      case 'PROCESSING_NO_SHOW':
        return (
          <div className="py-10 text-center space-y-4" aria-live="polite">
            <UpdateIcon
              className="w-8 h-8 animate-spin text-[#BA1A1A] mx-auto"
              aria-hidden="true"
            />
            <div className="text-base font-bold text-[#0F2942]">Marcando como no presentado…</div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Actualizando el turno y consultando el siguiente paciente en la cola.
            </p>
          </div>
        );

      case 'CLOSED_NEXT': {
        if (!activeTicket) return null;

        return (
          <div className="space-y-5">
            <SuccessNotice>
              Turno <strong>{outcome?.finishedCode ?? '—'}</strong> finalizado.
            </SuccessNotice>

            <div className="text-sm font-bold text-[#0F2942]">Siguiente turno asignado</div>

            <TicketSummary
              ticket={activeTicket}
              tone="neutral"
              label="Número de turno"
              timestamp="assigned"
            />

            <WaitingCounter count={workspace.waitingCount} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => void workspace.requestCall()}
                disabled={workspace.actionsDisabled}
                className={PRIMARY_BUTTON}
              >
                <PlayIcon className="w-4 h-4" aria-hidden="true" />
                Llamar siguiente turno
              </button>

              <div className="text-xs text-[#64748B]">
                El cierre del turno anterior ya fue confirmado por el servidor.
              </div>
            </div>
          </div>
        );
      }

      case 'CLOSED_NO_NEXT':
        return (
          <div className="space-y-5">
            <SuccessNotice>
              Turno <strong>{outcome?.finishedCode ?? '—'}</strong> finalizado.
            </SuccessNotice>

            <div className="py-6 text-center space-y-2">
              <div className="text-base font-bold text-[#0F2942]">
                {waitingPatientsLabel(workspace.waitingCount)}
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                El cubículo permanece disponible
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => void workspace.refresh()}
                disabled={workspace.isRefreshing}
                className={SECONDARY_BUTTON}
              >
                {workspace.isRefreshing ? (
                  <UpdateIcon className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ReloadIcon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Actualizar estado
              </button>

              <div className="text-xs text-[#64748B]">
                {workspace.isOnline ? 'Cubículo sincronizado' : 'Sin conexión con el servidor'}
              </div>
            </div>
          </div>
        );

      case 'NO_SHOW_NEXT': {
        if (!activeTicket) return null;

        return (
          <div className="space-y-5">
            <WarningNotice>
              Turno <strong>{outcome?.finishedCode ?? '—'}</strong> marcado como no presentado.
            </WarningNotice>

            <div className="text-sm font-bold text-[#0F2942]">Siguiente turno asignado</div>

            <TicketSummary
              ticket={activeTicket}
              tone="neutral"
              label="Número de turno"
              timestamp="assigned"
            />

            <WaitingCounter count={workspace.waitingCount} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => void workspace.requestCall()}
                disabled={workspace.actionsDisabled}
                className={PRIMARY_BUTTON}
              >
                <PlayIcon className="w-4 h-4" aria-hidden="true" />
                Llamar siguiente turno
              </button>

              <div className="text-xs text-[#64748B]">
                La inasistencia ya fue registrada por el servidor.
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-[#CBD5E1] bg-white p-5 sm:p-8 shadow-sm space-y-6 font-sans text-[#0F2942] ${className}`}
      aria-busy={isProcessing || step === 'RECONCILING'}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0F2942] text-white flex items-center justify-center font-mono font-bold text-base shrink-0 shadow-2xs">
            {workspace.cubicleNumber}
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Mi cubículo
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F2942] tracking-tight">
              {workspace.displayName}
            </h2>
          </div>
        </div>

        <div className="self-start sm:self-center">
          <StatusBadge step={step} />
        </div>
      </div>

      {!workspace.isOnline && workspace.snapshot && <OfflineBanner workspace={workspace} />}

      {renderBody()}

      {closeModal}
      {noShowModal}
    </div>
  );
};
