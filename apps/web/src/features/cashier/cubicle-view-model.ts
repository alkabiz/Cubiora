import { TicketStatus, type CubicleSnapshot } from '@cubiora/shared';
import type { CubicleVisualStep } from './types';

/**
 * Traduce exclusivamente el estado persistido del snapshot a la variante
 * visual base. Nunca recupera PROCESSING_*, CONFIRM_* ni resultados locales.
 */
export function deriveStableViewStep(snapshot: CubicleSnapshot): CubicleVisualStep {
  if (!snapshot.activeTicket) {
    return 'AVAILABLE';
  }

  switch (snapshot.activeTicket.status) {
    case TicketStatus.ASSIGNED:
      return 'ASSIGNED';
    case TicketStatus.CALLED:
      return 'CALLED';
    case TicketStatus.IN_SERVICE:
      return 'IN_SERVICE';
    default:
      return 'AVAILABLE';
  }
}

/**
 * Calcula la diferencia entre dos instantes del servidor y la presenta como
 * MM:SS. El segundo argumento debe ser la hora actual del servidor, no la del
 * navegador, para que un reloj local desfasado no altere el cronómetro.
 */
export function formatDuration(startedAt: string | null | undefined, serverNowMs: number): string {
  if (!startedAt) return '—';

  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs) || Number.isNaN(serverNowMs)) return '—';

  const totalSeconds = Math.max(0, Math.floor((serverNowMs - startedAtMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Presenta un timestamp ISO del servidor en el reloj local como HH:mm. */
export function formatClockTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Diferencia entre el reloj del servidor y el del navegador. Se aplica a
 * Date.now() en cada tick para que el cronómetro se derive siempre del
 * timestamp persistido y no de un acumulador de segundos local.
 */
export function getServerClockOffsetMs(
  serverTime: string | null | undefined,
  clientNowMs = Date.now(),
): number {
  if (!serverTime) return 0;

  const serverTimeMs = Date.parse(serverTime);
  if (Number.isNaN(serverTimeMs)) return 0;

  return serverTimeMs - clientNowMs;
}

/** Texto obligatorio del contador de cola. Nunca devuelve "0 pacientes". */
export function waitingPatientsLabel(waitingCount: number | null | undefined): string {
  const count = Math.max(0, Math.trunc(waitingCount ?? 0));

  if (count === 0) {
    return 'No hay pacientes en espera';
  }

  if (count === 1) {
    return '1 paciente en espera';
  }

  return `${count} pacientes en espera`;
}
