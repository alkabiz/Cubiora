import { assertDatabaseUrlSecurity, validateEnv } from '../src/config/env.validation';
import {
  loadInstitutionalCaCert,
  normalizePemCertificate,
} from '../src/common/utils/tls-ca.util';
import { PrismaService, resolvePgPoolOptions } from '../src/prisma/prisma.service';
import * as fs from 'fs';
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

  it('en producción: verify-full con hostname incorrecto (ej. IP numérica sin excepción) debe fallar y pasar solo con ALLOW_NUMERIC_IP_EXCEPTION=true', () => {
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_HOSTNAME_NO_VERIFICABLE/);

    process.env['ALLOW_NUMERIC_IP_EXCEPTION'] = 'true';
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).not.toThrow();
  });

  it('normaliza CA PEM entregada con escapes \\n/comillas en DATABASE_CA_CERT y rechaza cadenas no PEM', () => {
    const escapedInlinePem = '"-----BEGIN CERTIFICATE-----\\nTEST_CA_LINE_1\\r\\nTEST_CA_LINE_2\\n-----END CERTIFICATE-----"';
    const expectedPem = '-----BEGIN CERTIFICATE-----\nTEST_CA_LINE_1\nTEST_CA_LINE_2\n-----END CERTIFICATE-----';

    expect(normalizePemCertificate(escapedInlinePem)).toBe(expectedPem);

    process.env['DATABASE_CA_CERT_PATH'] = path.resolve(process.cwd(), 'non-existent-ca.crt');
    process.env['DATABASE_CA_CERT'] = escapedInlinePem;
    expect(loadInstitutionalCaCert()).toBe(expectedPem);

    const resolvedPool = resolvePgPoolOptions(
      'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-full',
      'production',
      false,
      escapedInlinePem,
    );
    expect(resolvedPool.ssl).toEqual({
      rejectUnauthorized: true,
      ca: expectedPem,
    });

    process.env['DATABASE_CA_CERT'] = 'not-a-valid-pem-certificate';
    expect(() => {
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-full',
        'DATABASE_URL',
        'production',
      );
    }).toThrow(/ERROR_SEGURIDAD_CA_INVALIDA/);
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

  it('resolvePgPoolOptions soporta ALLOW_DOCKER_INTERNAL_DB=true con sslmode=require y rechaza sslmode=disable en producción', () => {
    expect(() =>
      resolvePgPoolOptions(
        'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?schema=public&sslmode=disable',
        'production',
        true,
      ),
    ).toThrow(/FATAL_TLS_VERIFICATION_FAILED/);

    const internalProdResolved = resolvePgPoolOptions(
      'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?schema=public&sslmode=require',
      'production',
      true,
    );
    expect(internalProdResolved.connectionString).toBe(
      'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?schema=public',
    );
    expect(internalProdResolved.ssl).toEqual({ rejectUnauthorized: false });

    const devResolved = resolvePgPoolOptions(
      'postgresql://cubiora_app:pass@postgres:5432/cubiora_dev?schema=public&sslmode=require',
      'development',
      true,
    );

    expect(devResolved.connectionString).toBe(
      'postgresql://cubiora_app:pass@postgres:5432/cubiora_dev?schema=public',
    );
    expect(devResolved.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('assertDatabaseUrlSecurity rechaza host LAN en desarrollo sin flag y valida controles en ALLOW_DOCKER_INTERNAL_DB=true', () => {
    const originalAllowDocker = process.env['ALLOW_DOCKER_INTERNAL_DB'];
    const originalTlsRejectEnv = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    delete process.env['ALLOW_DOCKER_INTERNAL_DB'];

    expect(() =>
      assertDatabaseUrlSecurity(
        'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db',
        'DATABASE_URL',
        'development',
      ),
    ).toThrow(/ERROR_SEGURIDAD_HOST_NO_LOCAL/);

    delete process.env['DATABASE_CA_CERT'];
    delete process.env['CA_CERT'];
    process.env['DATABASE_CA_CERT_PATH'] = path.resolve(process.cwd(), 'non-existent-ca.crt');
    process.env['ALLOW_DOCKER_INTERNAL_DB'] = 'true';
    try {
      // En desarrollo con ALLOW_DOCKER_INTERNAL_DB=true: permite IP privada LAN con sslmode=require
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?sslmode=require',
          'DATABASE_URL',
          'development',
        ),
      ).not.toThrow();

      // En desarrollo hacia IP LAN exige sslmode>=require y sigue bloqueando hosts públicos
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?sslmode=disable',
          'DATABASE_URL',
          'development',
        ),
      ).toThrow(/ERROR_SEGURIDAD_SSL_REQUERIDO/);
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_app:pass@db.public-cloud.example:5432/cubiora_db?sslmode=require',
          'DATABASE_URL',
          'development',
        ),
      ).toThrow(/ERROR_SEGURIDAD_HOST_NO_LOCAL/);

      // Con ALLOW_DOCKER_INTERNAL_DB=true en producción retorna tras validar rol y TLS global (sin exigir CA/FQDN/verify-full)
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?sslmode=require',
          'DATABASE_URL',
          'production',
        ),
      ).not.toThrow();
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?schema=public',
          'DATABASE_URL',
          'production',
        ),
      ).not.toThrow();
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_migrator:pass@192.168.1.33:5432/cubiora_db?sslmode=require',
          'DIRECT_URL',
          'production',
        ),
      ).not.toThrow();

      // Sigue exigiendo rol cubiora_app en DATABASE_URL
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_migrator:pass@192.168.1.33:5432/cubiora_db?sslmode=require',
          'DATABASE_URL',
          'production',
        ),
      ).toThrow(/ERROR_SEGURIDAD_ROL_INVALIDO/);

      // Sigue prohibiendo NODE_TLS_REJECT_UNAUTHORIZED=0
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
      expect(() =>
        assertDatabaseUrlSecurity(
          'postgresql://cubiora_app:pass@192.168.1.33:5432/cubiora_db?sslmode=require',
          'DATABASE_URL',
          'production',
        ),
      ).toThrow(/ERROR_SEGURIDAD_TLS_INSEGURO/);
    } finally {
      if (originalAllowDocker !== undefined) {
        process.env['ALLOW_DOCKER_INTERNAL_DB'] = originalAllowDocker;
      } else {
        delete process.env['ALLOW_DOCKER_INTERNAL_DB'];
      }
      if (originalTlsRejectEnv !== undefined) {
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = originalTlsRejectEnv;
      } else {
        delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
      }
    }
  });

  it('resolvePgPoolOptions en producción estricta sin ALLOW_DOCKER_INTERNAL_DB exige CA institucional', () => {
    expect(() =>
      resolvePgPoolOptions(
        'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-full',
        'production',
        false,
        undefined,
      ),
    ).toThrow(/FATAL_TLS_VERIFICATION_FAILED/);

    const strictResolved = resolvePgPoolOptions(
      'postgresql://cubiora_app:pass@postgres.internal:5432/cubiora_db?sslmode=verify-full',
      'production',
      false,
      '-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----',
    );
    expect(strictResolved.ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----',
    });
  });

  it('validateEnv rechaza CORS_ORIGINS * y secretos débiles; acepta COOKIE_SECURE auto/true/false con default auto en producción', () => {
    const prevSnapshot = { ...process.env };
    try {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] =
        'postgresql://cubiora_app:StrongPass!123@postgres.internal:5432/cubiora_db?sslmode=verify-full';
      process.env['DIRECT_URL'] = '';
      process.env['SESSION_SECRET'] = 'RealStrongRandomSessionSecretAtLeast32Chars!';
      delete process.env['ALLOW_DOCKER_INTERNAL_DB'];
      delete process.env['DISPLAY_TOKEN'];
      process.env['CORS_ORIGINS'] = '*';
      process.env['COOKIE_SECURE'] = 'true';

      expect(() => validateEnv()).toThrow(/ERROR_SEGURIDAD_CORS/);

      process.env['CORS_ORIGINS'] = 'https://cubiora.samlapspeed.com';
      process.env['COOKIE_SECURE'] = 'false';
      expect(validateEnv().COOKIE_SECURE).toBe('false');

      process.env['COOKIE_SECURE'] = 'true';
      expect(validateEnv().COOKIE_SECURE).toBe('true');

      process.env['COOKIE_SECURE'] = 'auto';
      expect(validateEnv().COOKIE_SECURE).toBe('auto');

      // COOKIE_SECURE omitido o vacío toma 'auto' por defecto en producción para soporte dual HTTP local + HTTPS dominio
      delete process.env['COOKIE_SECURE'];
      expect(validateEnv().COOKIE_SECURE).toBe('auto');
      process.env['COOKIE_SECURE'] = '';
      expect(validateEnv().COOKIE_SECURE).toBe('auto');

      // DISPLAY_TOKEN débil falla; DISPLAY_TOKEN vacío resuelve a undefined
      process.env['COOKIE_SECURE'] = 'auto';
      process.env['DISPLAY_TOKEN'] = 'cubiora_production_display_token_ultra_secure_min_32_chars!';
      expect(() => validateEnv()).toThrow(/ERROR_SEGURIDAD_DISPLAY_TOKEN_DEBIL/);
      process.env['DISPLAY_TOKEN'] = '';
      expect(validateEnv().DISPLAY_TOKEN).toBeUndefined();

      process.env['SESSION_SECRET'] = 'cubiora_production_session_secret_ultra_secure_min_32_chars!';
      expect(() => validateEnv()).toThrow(/ERROR_SEGURIDAD_SECRET_DEBIL/);

      // Escenario Coolify LAN: ALLOW_DOCKER_INTERNAL_DB=true con 192.168.1.33 y sslmode=require sin CA
      process.env['SESSION_SECRET'] = 'RealStrongRandomSessionSecretAtLeast32Chars!';
      process.env['ALLOW_DOCKER_INTERNAL_DB'] = 'true';
      process.env['DATABASE_URL'] =
        'postgresql://cubiora_app:StrongPass!123@192.168.1.33:5432/cubiora_db?sslmode=require';
      process.env['DIRECT_URL'] =
        'postgresql://cubiora_migrator:StrongPass!123@192.168.1.33:5432/cubiora_db?sslmode=require';
      delete process.env['DATABASE_CA_CERT'];
      delete process.env['CA_CERT'];
      delete process.env['COOKIE_SECURE'];
      process.env['DISPLAY_TOKEN'] = '';

      const valid = validateEnv();
      expect(valid.COOKIE_SECURE).toBe('auto');
      expect(valid.DISPLAY_TOKEN).toBeUndefined();
    } finally {
      process.env = prevSnapshot;
    }
  });

  it('hardening de despliegue (Docker, Nginx, .env.production.example, CI/CD) cumple controles Phase 4', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');

    const composeProd = fs.readFileSync(path.join(repoRoot, 'docker-compose.yaml'), 'utf8');
    expect(composeProd).toContain('ALLOW_DOCKER_INTERNAL_DB: ${ALLOW_DOCKER_INTERNAL_DB:-false}');
    expect(composeProd).toContain('ALLOW_NUMERIC_IP_EXCEPTION: ${ALLOW_NUMERIC_IP_EXCEPTION:-false}');
    expect(composeProd).toContain('ALLOW_VERIFY_CA_EXCEPTION: ${ALLOW_VERIFY_CA_EXCEPTION:-false}');
    expect(composeProd).toContain('COOKIE_SECURE: ${COOKIE_SECURE:-auto}');
    expect(composeProd).toContain('DISPLAY_TOKEN: ${DISPLAY_TOKEN:-}');
    expect(composeProd).toContain(
      'CORS_ORIGINS: ${CORS_ORIGINS:-https://cubiora.samlapspeed.com,https://coolify.samlapspeed.com,http://localhost:5173,http://localhost,http://127.0.0.1}',
    );
    expect(composeProd).not.toContain('Admin2026!*');
    expect(composeProd).not.toContain('display_token_default_local_min_32_chars!');

    const envProdExample = fs.readFileSync(path.join(repoRoot, '.env.production.example'), 'utf8');
    expect(envProdExample).toContain('ALLOW_DOCKER_INTERNAL_DB=false');
    expect(envProdExample).toContain('ALLOW_NUMERIC_IP_EXCEPTION=false');
    expect(envProdExample).toContain('COOKIE_SECURE=true');
    expect(envProdExample).not.toContain('192.168.1.33');
    expect(envProdExample).not.toContain('Admin2026!*');
    expect(envProdExample).not.toContain('http://localhost');

    const nginxConf = fs.readFileSync(path.join(repoRoot, 'docker', 'nginx.conf'), 'utf8');
    expect(nginxConf).toContain('"~*^https$" https;');
    expect(nginxConf).toContain('server_tokens off;');
    expect(nginxConf).not.toContain('X-XSS-Protection');
    expect(nginxConf).not.toMatch(/connect-src[^;]*\bws:/);
    expect(nginxConf).toContain("object-src 'none'");

    const dockerfileApi = fs.readFileSync(path.join(repoRoot, 'docker', 'Dockerfile.api'), 'utf8');
    expect(dockerfileApi).toMatch(/FROM node:22-alpine@sha256:[0-9a-f]{64}/);
    expect(dockerfileApi).toContain('COREPACK_HOME="/pnpm/corepack"');
    expect(dockerfileApi).toContain('chown -R node:node /pnpm /app /home/node');
    expect(dockerfileApi).toContain('USER node');

    const dockerfileWeb = fs.readFileSync(path.join(repoRoot, 'docker', 'Dockerfile.web'), 'utf8');
    expect(dockerfileWeb).toMatch(/FROM nginx:stable-alpine@sha256:[0-9a-f]{64}/);
    expect(dockerfileWeb).toContain('USER nginx');

    const dockerignore = fs.readFileSync(path.join(repoRoot, '.dockerignore'), 'utf8');
    expect(dockerignore).toMatch(/^\.env$/m);
    expect(dockerignore).toContain('*.pem');
    expect(dockerignore).toContain('*.key');

    const entrypointSh = fs.readFileSync(
      path.join(repoRoot, 'docker', 'entrypoint.api.sh'),
      'utf8',
    );
    expect(entrypointSh).not.toContain('\r\n');
    expect(entrypointSh).toContain('NODE_EXTRA_CA_CERTS');
    expect(entrypointSh).toContain('sslrootcert');
    expect(entrypointSh).toContain('/tmp/cubiora-db-ca.crt');
    expect(entrypointSh).toContain('node ./node_modules/prisma/build/index.js migrate deploy');
    expect(entrypointSh).toContain('node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts');
    expect(entrypointSh).toContain('sslmode=no-verify');
    expect(entrypointSh).not.toContain('pnpm --filter api');

    for (const wf of ['ci.yml', 'cd.yml', 'codeql.yml']) {
      const content = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', wf), 'utf8');
      const usesLines = content.match(/uses:\s+[^\s]+/g) ?? [];
      expect(usesLines.length).toBeGreaterThan(0);
      for (const usesLine of usesLines) {
        if (usesLine.includes('./.github/workflows/')) {
          expect(usesLine).toBe('uses: ./.github/workflows/ci.yml');
        } else {
          expect(usesLine).toMatch(/@[0-9a-f]{40}$/);
        }
      }
    }

    const ciYaml = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
    expect(ciYaml).toContain('workflow_call:');
    expect(ciYaml).toContain('needs: [security-audit, lint-and-typecheck, test]');

    const cdYaml = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'cd.yml'), 'utf8');
    expect(cdYaml).toContain('uses: ./.github/workflows/ci.yml');
    expect(cdYaml).toContain('needs: [verify]');
    expect(cdYaml).toContain('needs: [deployment-gate]');
    expect(cdYaml).not.toContain('https://cubiora.local');

    const skillsLock = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'skills-lock.json'), 'utf8'),
    ) as { skills: Record<string, { computedHash?: string }> };
    for (const [skillName, entry] of Object.entries(skillsLock.skills)) {
      expect(entry.computedHash, `skills-lock missing hash for ${skillName}`).toMatch(
        /^[0-9a-f]{64}$/,
      );
    }
  });
});
