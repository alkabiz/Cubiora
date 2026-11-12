/**
 * Validación tipada y blindaje de variables de entorno al arrancar.
 * Si falta alguna variable obligatoria o si los hosts/roles violan las directivas
 * de seguridad, la aplicación falla inmediatamente (fail-fast).
 *
 * Usa Zod 4 para parsing y validación.
 */
import { z } from 'zod/v4';
import {
  hasPemCertificateMarkers,
  loadInstitutionalCaCert,
} from '../common/utils/tls-ca.util';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

function isPrivateOrInternalHost(host: string): boolean {
  if (LOCAL_HOSTS.has(host)) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if ([a, b, c, d].some((octet) => octet < 0 || octet > 255)) {
      return false;
    }
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  return /^[a-z0-9-]+$/i.test(host) || host.endsWith('.local') || host.endsWith('.internal');
}

const WEAK_PLACEHOLDER_SECRETS: ReadonlySet<string> = new Set([
  'display_token_default_local_min_32_chars!',
  'cubiora_production_display_token_ultra_secure_min_32_chars!',
  'cubiora_production_session_secret_ultra_secure_min_32_chars!',
]);

/**
 * Valida de forma estricta que las URLs de base de datos cumplan con las reglas
 * de seguridad arquitectónicas del PMV.
 *
 * @param urlStr Cadena de conexión a validar
 * @param varName Nombre de la variable ('DATABASE_URL' o 'DIRECT_URL')
 * @param nodeEnv Entorno actual ('development', 'production', 'test')
 */
export function assertDatabaseUrlSecurity(
  urlStr: string,
  varName: 'DATABASE_URL' | 'DIRECT_URL',
  nodeEnv: string,
): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    throw new Error(`[Seguridad] ${varName} no es una URL de conexión válida`);
  }

  const allowDockerInternalDb = process.env['ALLOW_DOCKER_INTERNAL_DB'] === 'true';

  // 1. Blindaje de TLS: Prohibición absoluta de NODE_TLS_REJECT_UNAUTHORIZED=0
  if (process.env['NODE_TLS_REJECT_UNAUTHORIZED'] === '0') {
    throw new Error(
      `[Seguridad] ERROR_SEGURIDAD_TLS_INSEGURO: NODE_TLS_REJECT_UNAUTHORIZED=0 detectado. Se prohíbe el bypass global de TLS en cualquier entorno.`,
    );
  }

  // 2. Blindaje fuera de producción: solo localhost/127.0.0.1/::1/postgres por defecto,
  //    o red privada/LAN con TLS cuando ALLOW_DOCKER_INTERNAL_DB=true está explícitamente activo.
  if (nodeEnv !== 'production') {
    const host = parsedUrl.hostname.toLowerCase();
    const sslmode = parsedUrl.searchParams.get('sslmode')?.toLowerCase();

    if (allowDockerInternalDb) {
      if (!isPrivateOrInternalHost(host)) {
        throw new Error(
          `[Seguridad] ERROR_SEGURIDAD_HOST_NO_LOCAL: En entorno '${nodeEnv}' con ALLOW_DOCKER_INTERNAL_DB=true, ${varName} solo puede apuntar a hosts locales o de red privada LAN. Host detectado: '${host}'.`,
        );
      }
      if (!LOCAL_HOSTS.has(host)) {
        const allowedInternalSslModes = new Set(['require', 'verify-ca', 'verify-full']);
        if (!sslmode || !allowedInternalSslModes.has(sslmode)) {
          throw new Error(
            `[Seguridad] ERROR_SEGURIDAD_SSL_REQUERIDO: En entorno '${nodeEnv}' hacia host LAN '${host}', ${varName} debe incluir al menos 'sslmode=require'. Modo detectado: '${sslmode ?? 'ninguno'}'.`,
          );
        }
      }
    } else if (!LOCAL_HOSTS.has(host)) {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_HOST_NO_LOCAL: En entorno '${nodeEnv}', ${varName} solo puede apuntar a localhost, 127.0.0.1 o ::1. Host detectado: '${host}'. Conexión a base de datos externa o remota estrictamente prohibida.`,
      );
    }
  }

  // 3. Blindaje en producción: rol exclusivo cubiora_app y TLS obligatorio
  if (nodeEnv === 'production') {

    if (varName === 'DATABASE_URL') {
      const username = decodeURIComponent(parsedUrl.username);
      if (username !== 'cubiora_app') {
        throw new Error(
          `[Seguridad] ERROR_SEGURIDAD_ROL_INVALIDO: En producción, DATABASE_URL debe utilizar exclusivamente el rol 'cubiora_app'. Rol detectado: '${username}'.`,
        );
      }
    }

    if (allowDockerInternalDb) {
      // Excepción explícita para PostgreSQL en red interna/LAN (p. ej. 192.168.1.33):
      // tras validar el rol cubiora_app (en DATABASE_URL) y NODE_TLS_REJECT_UNAUTHORIZED !== '0',
      // retorna inmediatamente sin rechazar sslmode=require ni exigir CA local ni hostname FQDN.
      return;
    }

    const sslmode = parsedUrl.searchParams.get('sslmode')?.toLowerCase();

    // - require falla categóricamente en producción estricta
    if (sslmode === 'require') {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_SSL_REQUIRE_RECHAZADO: 'sslmode=require' es insuficiente en producción. Se exige verificación completa con 'sslmode=verify-full'.`,
      );
    }

    // - verify-ca falla salvo excepción aprobada explícita
    if (sslmode === 'verify-ca') {
      const allowVerifyCa = process.env['ALLOW_VERIFY_CA_EXCEPTION'] === 'true';
      if (!allowVerifyCa) {
        throw new Error(
          `[Seguridad] ERROR_SEGURIDAD_SSL_VERIFY_CA_DENEGADO: 'sslmode=verify-ca' no es aceptado en producción salvo excepción explícita aprobada (ALLOW_VERIFY_CA_EXCEPTION=true). Se exige 'sslmode=verify-full'.`,
        );
      }
    }

    // - Solo se acepta verify-full (o verify-ca bajo excepción aprobada)
    if (sslmode !== 'verify-full' && process.env['ALLOW_VERIFY_CA_EXCEPTION'] !== 'true') {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_SSL_REQUERIDO: En producción, ${varName} debe incluir exclusivamente 'sslmode=verify-full'. Modo detectado: '${sslmode ?? 'ninguno'}'.`,
      );
    }

    // - Exigir ruta o contenido de CA institucional en formato PEM válido
    const caCert = loadInstitutionalCaCert();

    if (!caCert) {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_CA_REQUERIDA: En producción con verify-full se exige la ruta o contenido del certificado CA institucional (DATABASE_CA_CERT, DATABASE_CA_CERT_PATH o ca-cert.crt).`,
      );
    }

    if (!hasPemCertificateMarkers(caCert)) {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_CA_INVALIDA: El certificado CA proporcionado no tiene formato PEM X.509 válido (BEGIN/END CERTIFICATE).`,
      );
    }

    // - Exigir hostname verificable (no IP numérica plana, no localhost, debe ser FQDN)
    const host = parsedUrl.hostname.toLowerCase();
    const isNumericIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const allowNumericIp = process.env['ALLOW_NUMERIC_IP_EXCEPTION'] === 'true';

    if (!host || (isNumericIp && !allowNumericIp)) {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_HOSTNAME_NO_VERIFICABLE: En producción, el host de la base de datos debe ser un FQDN verificable contra el certificado TLS (ej. postgres.internal). Host detectado: '${host}'.`,
      );
    }
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // Base de datos (DIRECT_URL es opcional para runtime de la API; la API productiva no debe requerir credenciales de migrador)
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
    DIRECT_URL: z.string().optional(),

    // Seguridad
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
    DISPLAY_TOKEN: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z
        .string()
        .min(32, 'DISPLAY_TOKEN debe tener al menos 32 caracteres')
        .optional(),
    ),
    CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS es obligatorio'),
    COOKIE_SECURE: z
      .preprocess(
        (val) =>
          typeof val === 'string' && val.trim() === ''
            ? undefined
            : typeof val === 'string'
              ? val.trim().toLowerCase()
              : val,
        z.enum(['true', 'false', 'auto']).default('auto'),
      ),

    // Logging
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .default('info'),

    // Negocio
    NO_SHOW_MAX_CALLS: z.coerce.number().int().min(1).max(10).default(3),
    CUBICLE_DAILY_TARGET_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(86_400)
      .default(12 * 60),
  })
  .superRefine((data, ctx) => {
    const origins = data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (origins.length === 0 || origins.some((origin) => origin === '*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "[Seguridad] ERROR_SEGURIDAD_CORS: CORS_ORIGINS no puede estar vacío ni incluir el comodín '*'.",
        path: ['CORS_ORIGINS'],
      });
    }

    if (data.NODE_ENV === 'production') {
      if (WEAK_PLACEHOLDER_SECRETS.has(data.SESSION_SECRET.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '[Seguridad] ERROR_SEGURIDAD_SECRET_DEBIL: SESSION_SECRET no puede usar un valor de plantilla o ejemplo en producción.',
          path: ['SESSION_SECRET'],
        });
      }

      if (data.DISPLAY_TOKEN && WEAK_PLACEHOLDER_SECRETS.has(data.DISPLAY_TOKEN.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '[Seguridad] ERROR_SEGURIDAD_DISPLAY_TOKEN_DEBIL: DISPLAY_TOKEN no puede usar un valor de ejemplo en producción.',
          path: ['DISPLAY_TOKEN'],
        });
      }
    }

    try {
      assertDatabaseUrlSecurity(data.DATABASE_URL, 'DATABASE_URL', data.NODE_ENV);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : String(err),
        path: ['DATABASE_URL'],
      });
    }

    if (data.DIRECT_URL && data.DIRECT_URL.trim() !== '') {
      try {
        assertDatabaseUrlSecurity(data.DIRECT_URL, 'DIRECT_URL', data.NODE_ENV);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : String(err),
          path: ['DIRECT_URL'],
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parsea y valida las variables de entorno.
 * Lanzar en el arranque de la aplicación (main.ts antes de NestFactory.create).
 * @throws {Error} Si alguna variable falta, tiene formato incorrecto o viola las reglas de seguridad.
 */
export function validateEnv(): AppEnv {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = z.prettifyError(result.error);
    throw new Error(`[Config] Variables de entorno inválidas o inseguras:\n${issues}`);
  }

  return result.data;
}

/** Singleton — se llama una sola vez desde main.ts */
let _env: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!_env) {
    throw new Error('[Config] getEnv() llamado antes de validateEnv()');
  }
  return _env;
}

export function initEnv(): AppEnv {
  _env = validateEnv();
  return _env;
}
