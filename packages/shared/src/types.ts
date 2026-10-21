/**
 * Tipos públicos compartidos entre api y web.
 *
 * REGLA DE PRIVACIDAD: Este archivo NUNCA debe exponer patientName
 * ni patientDocument. Estos campos son datos personales sensibles
 * y solo existen en el backend, nunca en tipos públicos.
 */

/**
 * Información de un llamado visible en la pantalla pública.
 * No contiene datos personales del paciente.
 * @see RF-005 — Pantalla Pública de Llamados
 * @see apps/web/src/features/display
 */
import { CubicleStatus, TicketStatus } from './enums.js';

export interface PublicCall {
  /** Código único del turno en formato TUR-XXXXXX-YY (ej: TUR-000123-A7) */
  publicCode: string;
  /** Nombre descriptivo del cubículo (ej: "Cubículo 03", "Cubículo 1") */
  cubicleDisplayName: string;
  /** Timestamp ISO 8601 del momento del llamado */
  calledAt: string;
  /** Número secuencial de llamado (1 = primer llamado, 2 = segundo, etc.) */
  callNumber: number;
}

/**
 * Snapshot del estado de la pantalla pública.
 * Cero PII: no contiene nombres de pacientes ni documentos.
 */
export interface PublicDisplaySnapshot {
  currentCall: PublicCall | null;
  recentCalls: PublicCall[];
}

/**
 * Evento emitido a través de SSE hacia la pantalla pública.
 */
export interface PublicDisplayEvent {
  type: 'ticket.called' | 'ticket.recalled';
  data: PublicCall;
}

/**
 * Información de turno activo en un cubículo (para operador de caja).
 */
export interface CubicleActiveTicket {
  id: string;
  publicId: string;
  publicCode: string;
  patientName: string;
  /**
   * Documento del paciente ya enmascarado por el backend.
   * El documento completo nunca sale del servidor.
   */
  maskedDocument?: string | null;
  status: TicketStatus;
  version: number;
  assignedAt?: string | null;
  calledAt?: string | null;
  serviceStartedAt?: string | null;
  callNumber: number;
}

/**
 * Snapshot del estado de un cubículo específico devuelto por GET /cubicles/:code/current
 */
export interface CubicleSnapshot {
  cubicle: {
    id: string;
    code: string;
    displayName: string;
    status: CubicleStatus;
    version: number;
  };
  activeTicket: CubicleActiveTicket | null;
  /** Pacientes pendientes de asignación al momento de construir el snapshot. */
  waitingCount: number;
  /** Hora del servidor usada como referencia para cronómetros y offsets de reloj. */
  serverTime: string;
}

/**
 * Formato estándar de error devuelto por la API.
 * @see apps/api/src/common/filters/global-exception.filter.ts
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
}

/**
 * Respuesta envuelta estándar de la API para operaciones exitosas.
 */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}
