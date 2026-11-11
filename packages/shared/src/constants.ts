/**
 * Expresión regular oficial y compartida para el código público de turnos.
 * Permite 6 dígitos secuenciales y 2 caracteres alfanuméricos de sufijo (ej: TUR-000123-GE, TUR-000123-PR, TUR-000123-A7).
 * Formato canónico: ^TUR-[0-9]{6}-[A-Z0-9]{2}$
 */
export const TICKET_CODE_REGEX = /^TUR-[0-9]{6}-[A-Z0-9]{2}$/;

/** Longitud fija exacta del código público de turno (13 caracteres) */
export const TICKET_CODE_LENGTH = 13;

/**
 * Valida si una cadena cumple con la sintaxis oficial de código público de turno.
 */
export function isValidTicketCode(code: unknown): code is string {
  return typeof code === 'string' && code.length === TICKET_CODE_LENGTH && TICKET_CODE_REGEX.test(code);
}

/**
 * Expresión regular para validar publicId de recursos (ULID de 26 caracteres alfanuméricos o UUID v4).
 */
export const PUBLIC_ID_REGEX = /^[0-9A-HJ-KM-NP-TV-Z]{26}$|^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida si un identificador corresponde a un publicId válido (ULID/UUID).
 */
export function isValidPublicId(id: unknown): id is string {
  return typeof id === 'string' && PUBLIC_ID_REGEX.test(id);
}

import {
  FacilityStatus,
  PharmacistOperationalRole,
  PharmacistStatus,
  UserRole,
  WorkShift,
} from './enums.js';

/**
 * Diccionario institucional centralizado para nombres de estados operativos de cubículo en español.
 * Garantiza consistencia en SCR-ADM-001, SCR-ADM-002 y SCR-CAJ-001.
 */
export const CUBICLE_STATUS_LABELS_ES = {
  BUSY: 'ATENDIENDO',
  EXCEEDED: 'SLA EXCEDIDO',
  CALLING: 'LLAMANDO',
  AVAILABLE: 'DISPONIBLE',
  INACTIVE: 'INACTIVO',
} as const;

export type CubicleOperationalStatusCode = keyof typeof CUBICLE_STATUS_LABELS_ES;

/** Etiquetas institucionales para estados de sede hospitalaria (SCR-ADM-005). */
export const FACILITY_STATUS_LABELS_ES: Record<FacilityStatus, string> = {
  [FacilityStatus.ACTIVE]: 'Activa / En operación',
  [FacilityStatus.MAINTENANCE]: 'Mantenimiento',
  [FacilityStatus.INACTIVE]: 'Inactiva',
};

/** Etiquetas institucionales para rol operacional del farmacéutico (SCR-ADM-004). */
export const PHARMACIST_ROLE_LABELS_ES: Record<PharmacistOperationalRole, string> = {
  [PharmacistOperationalRole.TITULAR]: 'Farmacéutico Titular',
  [PharmacistOperationalRole.ADJUNTO]: 'Adjunto',
  [PharmacistOperationalRole.DISPENSADOR]: 'Dispensador',
  [PharmacistOperationalRole.GUARDIA]: 'Guardia',
};

/** Etiquetas cortas de rol operacional para badges y tablas compactas. */
export const PHARMACIST_ROLE_SHORT_LABELS_ES: Record<PharmacistOperationalRole, string> = {
  [PharmacistOperationalRole.TITULAR]: 'Titular',
  [PharmacistOperationalRole.ADJUNTO]: 'Adjunto',
  [PharmacistOperationalRole.DISPENSADOR]: 'Dispensador',
  [PharmacistOperationalRole.GUARDIA]: 'Guardia',
};

/** Etiquetas descriptivas con rango horario para turnos de trabajo (SCR-ADM-004). */
export const WORK_SHIFT_LABELS_ES: Record<WorkShift, string> = {
  [WorkShift.MORNING]: 'Mañana (07:00 a 14:00)',
  [WorkShift.AFTERNOON]: 'Tarde (14:00 a 20:00)',
  [WorkShift.NIGHT]: 'Noche (20:00 a 07:00)',
  [WorkShift.ROTATING]: 'Rotativo',
};

/** Etiquetas cortas de turno horario para columnas de tabla. */
export const WORK_SHIFT_SHORT_LABELS_ES: Record<WorkShift, string> = {
  [WorkShift.MORNING]: 'Mañana',
  [WorkShift.AFTERNOON]: 'Tarde',
  [WorkShift.NIGHT]: 'Noche',
  [WorkShift.ROTATING]: 'Rotativo',
};

/** Etiquetas de estado operativo del farmacéutico (SCR-ADM-004). */
export const PHARMACIST_STATUS_LABELS_ES: Record<PharmacistStatus, string> = {
  [PharmacistStatus.ACTIVE]: 'ACTIVO',
  [PharmacistStatus.ON_LEAVE]: 'LICENCIA',
  [PharmacistStatus.INACTIVE]: 'INACTIVO',
};

/** Etiquetas institucionales para roles de usuarios operativos del sistema (SCR-ADM-005). */
export const USER_ROLE_LABELS_ES: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.CASHIER]: 'Operador de Cubículo',
  [UserRole.RECEPTION]: 'Recepción',
};
