import { BadRequestException } from '@nestjs/common';
import { ParsePublicIdPipe } from '../src/common/pipes/parse-public-id.pipe';

describe('Unificación de Identificadores en Rutas (publicId obligatorio en comandos)', () => {
  const pipe = new ParsePublicIdPipe();

  it('debe aceptar un ULID de 26 caracteres como publicId válido', () => {
    const validUlid = '01J9X1K4M5N6P7Q8R9S0T1V2W3';
    expect(pipe.transform(validUlid)).toBe(validUlid);
  });

  it('debe aceptar un UUID v4 como publicId válido', () => {
    const validUuid = 'c28a2b5e-4f1b-4f7b-9457-4b6140510619';
    expect(pipe.transform(validUuid)).toBe(validUuid);
  });

  it('debe RECHAZAR categóricamente publicCode (TUR-000123-GE) en comandos con 400 Bad Request', () => {
    const publicCode = 'TUR-000123-GE';
    expect(() => pipe.transform(publicCode)).toThrow(BadRequestException);
    try {
      pipe.transform(publicCode);
    } catch (e: unknown) {
      const err = e as { getResponse: () => Record<string, unknown> };
      const resp = err.getResponse();
      expect(resp['code']).toBe('REQUEST_INVALID');
      expect(resp['message']).toContain('requieren publicId, no publicCode');
    }
  });

  it('debe rechazar cadenas vacías o valores nulos/no válidos', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
    expect(() => pipe.transform('invalid-id-xyz')).toThrow(BadRequestException);
  });
});
