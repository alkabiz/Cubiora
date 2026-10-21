/**
 * Utilidades de privacidad compartidas.
 *
 * El documento completo de un paciente nunca debe formar parte de un DTO,
 * snapshot ni payload de presentación. Esta función es la única conversión
 * permitida para exponer documentación en la pantalla privada del cubículo.
 */

const DOCUMENT_PREFIX = 'C.C. ';
const MASK = '•';
const MIN_MASKED_DIGITS = 6;
const VISIBLE_DIGITS = 4;

/**
 * Enmascara un documento conservando como máximo sus últimos cuatro dígitos.
 * Si el documento tiene pocos dígitos, se oculta al menos uno de ellos.
 *
 * Ejemplo: `79.438.212` → `C.C. ••••••8212`
 */
export function maskDocument(document?: string | null): string | null {
  const digits = document?.replace(/\D/g, '') ?? '';

  if (!digits) return null;

  // Para documentos de cuatro dígitos o menos se ocultan todos: mostrar
  // cualquiera de ellos revelaría una parte demasiado grande del original.
  const visibleLength = digits.length > VISIBLE_DIGITS ? VISIBLE_DIGITS : 0;
  const visibleDigits = visibleLength > 0 ? digits.slice(-visibleLength) : '';
  const maskedLength =
    visibleLength > 0
      ? Math.max(MIN_MASKED_DIGITS, digits.length - visibleLength)
      : Math.max(MIN_MASKED_DIGITS, digits.length);

  return `${DOCUMENT_PREFIX}${MASK.repeat(maskedLength)}${visibleDigits}`;
}
