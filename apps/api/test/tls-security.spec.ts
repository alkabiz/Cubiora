import { assertDatabaseUrlSecurity } from '../src/config/env.validation';

describe('Seguridad TLS y Validación de Arranque en Producción', () => {
  const originalTlsReject = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];

  afterEach(() => {
    if (originalTlsReject !== undefined) {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = originalTlsReject;
    } else {
      delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    }
  });

  it('debe rechazar categóricamente NODE_TLS_REJECT_UNAUTHORIZED=0', () => {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@127.0.0.1:5432/cubiora_db',
        'DATABASE_URL',
        'development',
      );
    }).toThrow(/ERROR_SEGURIDAD_TLS_INSEGURO/);
  });

  it('en producción, debe exigir rol cubiora_app para DATABASE_URL', () => {
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_migrator:pass@db.internal:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_ROL_INVALIDO/);
  });

  it('en producción, debe exigir sslmode verify-full o verify-ca o require', () => {
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@db.internal:5432/cubiora_db?sslmode=disable',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_SSL_REQUERIDO/);
  });

  it('en producción, debe aceptar conexión válida con cubiora_app y sslmode=verify-full', () => {
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@db.internal:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).not.toThrow();
  });
});
