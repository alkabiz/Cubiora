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
  HIGH_COST = 'HIGH_COST',
  BILLING = 'BILLING',
}

/**
 * Resultado y resolución de la dispensación al cerrar el turno en ventanilla.
 * - TOTAL_DELIVERED: Entrega nominal completa de los medicamentos prescritos.
 * - PENDING_48H: Medicamento pendiente con promesa de entrega domiciliaria <= 48 horas (Res. 1604/2013 MinSalud).
 * - PRESCRIPTION_REJECTED: Rechazo por inconsistencia médica o legal.
 * - CANCELLED_BY_PATIENT: Desistimiento voluntario por parte del usuario.
 */
export enum DispensationResolution {
  TOTAL_DELIVERED = 'TOTAL_DELIVERED',
  PENDING_48H = 'PENDING_48H',
  PRESCRIPTION_REJECTED = 'PRESCRIPTION_REJECTED',
  CANCELLED_BY_PATIENT = 'CANCELLED_BY_PATIENT',
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

/**
 * Estados operativos de una sede / punto de dispensación hospitalaria.
 * @see [SCR-ADM-005] Gestión de Sedes y Usuarios Asociados
 */
export enum FacilityStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

/**
 * Roles operacionales de los profesionales farmacéuticos registrados.
 * @see [SCR-ADM-004] Gestión de Farmacéuticos Registrados
 */
export enum PharmacistOperationalRole {
  TITULAR = 'TITULAR',
  ADJUNTO = 'ADJUNTO',
  DISPENSADOR = 'DISPENSADOR',
  GUARDIA = 'GUARDIA',
}

/**
 * Turnos horarios de servicio asignables al personal farmacéutico.
 * @see [SCR-ADM-004] Gestión de Farmacéuticos Registrados
 */
export enum WorkShift {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
  ROTATING = 'ROTATING',
}

/**
 * Estados de habilitación operativa de un farmacéutico registrado.
 * @see [SCR-ADM-004] Gestión de Farmacéuticos Registrados
 */
export enum PharmacistStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  INACTIVE = 'INACTIVE',
}
