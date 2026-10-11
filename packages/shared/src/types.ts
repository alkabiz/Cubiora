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
export interface PublicCall {
  /** Código único del turno en formato TUR-XXXXXX-YY (ej: TUR-000123-A7) */
  publicCode: string;
  /** Nombre descriptivo del cubículo (ej: "Cubículo 1", "Ventanilla A") */
  cubicleDisplayName: string;
  /** Timestamp ISO 8601 del momento del llamado */
  calledAt: string;
  /** Número secuencial de llamado (1 = primer llamado, 2 = segundo, etc.) */
  callNumber: number;
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
