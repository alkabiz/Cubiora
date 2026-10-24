/**
 * Enumeraciones de dominio compartidas entre api y web.
 * Cualquier cambio aquí impacta ambas aplicaciones — coordinar con el equipo.
 */

/**
 * Roles de usuario del sistema.
 * - RECEPTION: Crea turnos y gestiona la cola.
 * - CASHIER: Gestiona un cubículo y atiende turnos.
 * - ADMIN: Acceso completo a configuración e historial.
 * @see Documento Técnico PMV v1.0 — Sección de Roles
 */
export enum UserRole {
  RECEPTION = 'RECEPTION',
  CASHIER = 'CASHIER',
  ADMIN = 'ADMIN',
}

/**
 * Estados posibles de un cubículo.
 * AVAILABLE → (turno asignado) → RESERVED → (llamado) → CALLING
 * CALLING → (atención iniciada) → BUSY → (cierre) → AVAILABLE
 * INACTIVE: cubículo deshabilitado por administración.
 */
export enum CubicleStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  CALLING = 'CALLING',
  BUSY = 'BUSY',
  INACTIVE = 'INACTIVE',
}

/**
 * Estados del ciclo de vida de un turno.
 * Flujo nominal: PENDING → ASSIGNED → CALLED → IN_SERVICE → CLOSED
 * Flujo alternativo: CALLED → NO_SHOW (tras NO_SHOW_MAX_CALLS llamados sin respuesta)
 * Cancelación posible desde: PENDING, ASSIGNED, CALLED
 * @see RF-001 a RF-008 del Documento Técnico PMV v1.0
 */
export enum TicketStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  CALLED = 'CALLED',
  IN_SERVICE = 'IN_SERVICE',
  CLOSED = 'CLOSED',
  NO_SHOW = 'NO_SHOW',
  CANCELLED = 'CANCELLED',
}

/**
 * Clasificación operacional del turno en cola.
 * - GENERAL: Atención según el orden de llegada (FIFO).
 * - PREFERENTIAL: Atención preferencial respaldada por criterio institucional autorizado.
 * No sustituye el estado del turno (TicketStatus).
 */
export enum QueueCategory {
  GENERAL = 'GENERAL',
  PREFERENTIAL = 'PREFERENTIAL',
}

/**
 * Códigos de error de la API.
 * Deben coincidir con los producidos por GlobalExceptionFilter en apps/api.
 * @see apps/api/src/common/filters/global-exception.filter.ts
 */
export enum ApiErrorCode {
  REQUEST_INVALID = 'REQUEST_INVALID',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  FORBIDDEN = 'FORBIDDEN',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  STATE_CONFLICT = 'STATE_CONFLICT',
  BUSINESS_RULE_FAILED = 'BUSINESS_RULE_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
}
