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
