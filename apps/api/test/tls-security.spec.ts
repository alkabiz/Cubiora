import { assertDatabaseUrlSecurity } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';
import * as path from 'path';

describe('Seguridad TLS y Validación de Arranque en Producción (verify-full obligatorio)', () => {
  const originalTlsReject = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
  const originalCaCert = process.env['DATABASE_CA_CERT'];
  const originalCaPath = process.env['DATABASE_CA_CERT_PATH'];
  const originalAllowVerifyCa = process.env['ALLOW_VERIFY_CA_EXCEPTION'];
  const originalAllowNumericIp = process.env['ALLOW_NUMERIC_IP_EXCEPTION'];

  beforeEach(() => {
    // Configurar CA por defecto para tests
    process.env['DATABASE_CA_CERT'] = '-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----';
    delete process.env['ALLOW_VERIFY_CA_EXCEPTION'];
    delete process.env['ALLOW_NUMERIC_IP_EXCEPTION'];
  });

  afterEach(() => {
    if (originalTlsReject !== undefined) {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = originalTlsReject;
    } else {
      delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    }

    if (originalCaCert !== undefined) {
      process.env['DATABASE_CA_CERT'] = originalCaCert;
    } else {
      delete process.env['DATABASE_CA_CERT'];
    }

    if (originalCaPath !== undefined) {
      process.env['DATABASE_CA_CERT_PATH'] = originalCaPath;
    } else {
      delete process.env['DATABASE_CA_CERT_PATH'];
    }

    if (originalAllowVerifyCa !== undefined) {
      process.env['ALLOW_VERIFY_CA_EXCEPTION'] = originalAllowVerifyCa;
    } else {
      delete process.env['ALLOW_VERIFY_CA_EXCEPTION'];
    }

    if (originalAllowNumericIp !== undefined) {
      process.env['ALLOW_NUMERIC_IP_EXCEPTION'] = originalAllowNumericIp;
    } else {
      delete process.env['ALLOW_NUMERIC_IP_EXCEPTION'];
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
        'postgresql://cubiora_migrator:pass@postgres.internal:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_ROL_INVALIDO/);
  });

  it('en producción: sslmode=require debe fallar (no aceptado como cumplimiento)', () => {
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=require',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_SSL_REQUIRE_RECHAZADO/);
  });

  it('en producción: sslmode=verify-ca debe fallar salvo excepción aprobada', () => {
    delete process.env['ALLOW_VERIFY_CA_EXCEPTION'];
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-ca',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_SSL_VERIFY_CA_DENEGADO/);
  });

  it('en producción: sslmode=verify-ca pasa si existe excepción aprobada explícita', () => {
    process.env['ALLOW_VERIFY_CA_EXCEPTION'] = 'true';
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-ca',
        'DATABASE_URL',
        'production',
      );
    }).not.toThrow();
  });

  it('en producción: verify-full sin CA debe fallar', () => {
    delete process.env['DATABASE_CA_CERT'];
    delete process.env['CA_CERT'];
    process.env['DATABASE_CA_CERT_PATH'] = path.resolve(process.cwd(), 'non-existent-ca.crt');

    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_CA_REQUERIDA/);
  });

  it('en producción: verify-full con hostname incorrecto (ej. IP numérica sin excepción) debe fallar', () => {
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_HOSTNAME_NO_VERIFICABLE/);
  });

  it('en producción: verify-full correcto con FQDN y CA institucional debe pasar', () => {
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).not.toThrow();
  });

  it('getSslStatus debe consultar pg_stat_ssl y retornar ssl, version, cipher, bits sin secretos', async () => {
    const mockQueryRaw = vi.fn().mockResolvedValue([
      { ssl: true, version: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384', bits: 256 },
    ]);
    const mockPrismaService = {
      $queryRaw: mockQueryRaw,
      getSslStatus: PrismaService.prototype.getSslStatus,
    };

    const sslStatus = await mockPrismaService.getSslStatus();
    expect(sslStatus).toEqual({
      ssl: true,
      version: 'TLSv1.3',
      cipher: 'TLS_AES_256_GCM_SHA384',
      bits: 256,
    });
    // Garantizar que ningún campo de credencial, usuario o secreto es retornado
    expect((sslStatus as any).password).toBeUndefined();
    expect((sslStatus as any).token).toBeUndefined();
    expect((sslStatus as any).secret).toBeUndefined();
  });
});
