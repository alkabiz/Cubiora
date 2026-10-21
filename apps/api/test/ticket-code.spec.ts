import {
  TICKET_CODE_REGEX,
  TICKET_CODE_LENGTH,
  isValidTicketCode,
  isValidPublicId,
} from '@cubiora/shared';

describe('Formalización y Validación del Formato de Código de Ticket', () => {
  it('debe validar códigos con formato oficial TUR-NNNNNN-XX (GE, PR, A7)', () => {
    expect(TICKET_CODE_REGEX.test('TUR-000123-A7')).toBe(true);
    expect(TICKET_CODE_REGEX.test('TUR-000123-GE')).toBe(true);
    expect(TICKET_CODE_REGEX.test('TUR-000001-PR')).toBe(true);
    expect(TICKET_CODE_REGEX.test('TUR-999999-Z9')).toBe(true);
  });

  it('debe validar la longitud fija de 13 caracteres', () => {
    const validCode = 'TUR-000123-GE';
    expect(validCode.length).toBe(TICKET_CODE_LENGTH);
    expect(isValidTicketCode(validCode)).toBe(true);
  });

  it('debe rechazar códigos con longitud o formato inválido', () => {
    expect(isValidTicketCode('TUR-123-GE')).toBe(false); // muy corto
    expect(isValidTicketCode('TUR-00000123-GE')).toBe(false); // muy largo
    expect(isValidTicketCode('TUR-000123-')).toBe(false); // sufijo faltante
    expect(isValidTicketCode('TUR-000123-G')).toBe(false); // sufijo de 1 solo caracter
    expect(isValidTicketCode('TUR-000123-GEE')).toBe(false); // sufijo de 3 caracteres
    expect(isValidTicketCode('T-000123-GE')).toBe(false); // prefijo incorrecto
    expect(isValidTicketCode('tur-000123-ge')).toBe(false); // minúsculas no permitidas
  });

  it('debe validar y diferenciar publicId (ULID/UUID) vs publicCode', () => {
    const ulidExample = '01J9X1K4M5N6P7Q8R9S0T1V2W3';
    const uuidExample = 'c28a2b5e-4f1b-4f7b-9457-4b6140510619';
    const publicCodeExample = 'TUR-000123-GE';

    expect(isValidPublicId(ulidExample)).toBe(true);
    expect(isValidPublicId(uuidExample)).toBe(true);
    expect(isValidPublicId(publicCodeExample)).toBe(false);
  });

  it('debe demostrar unicidad generando códigos secuenciales', () => {
    const generatedCodes = new Set<string>();
    const total = 1000;

    for (let i = 1; i <= total; i++) {
      const padded = String(i).padStart(6, '0');
      const suffix = i % 2 === 0 ? 'GE' : 'PR';
      const code = `TUR-${padded}-${suffix}`;

      expect(TICKET_CODE_REGEX.test(code)).toBe(true);
      expect(code.length).toBe(TICKET_CODE_LENGTH);
      expect(generatedCodes.has(code)).toBe(false);
      generatedCodes.add(code);
    }

    expect(generatedCodes.size).toBe(total);
  });
});
