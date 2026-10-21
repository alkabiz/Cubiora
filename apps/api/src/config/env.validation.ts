/**
 * Validación tipada y blindaje de variables de entorno al arrancar.
 * Si falta alguna variable obligatoria o si los hosts/roles violan las directivas
 * de seguridad, la aplicación falla inmediatamente (fail-fast).
 *
 * Usa Zod 4 para parsing y validación.
 */
import { z } from 'zod/v4';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '192.168.1.33']);

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

  // 1. Blindaje fuera de producción: la conexión SOLO puede apuntar a localhost/127.0.0.1/::1
  if (nodeEnv !== 'production') {
    const host = parsedUrl.hostname.toLowerCase();
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_HOST_NO_LOCAL: En entorno '${nodeEnv}', ${varName} solo puede apuntar a localhost, 127.0.0.1 o ::1. Host detectado: '${host}'. Conexión a base de datos externa o remota estrictamente prohibida.`,
      );
    }
  }

  // 2. Blindaje de TLS: Prohibición absoluta de NODE_TLS_REJECT_UNAUTHORIZED=0
  if (process.env['NODE_TLS_REJECT_UNAUTHORIZED'] === '0') {
    throw new Error(
      `[Seguridad] ERROR_SEGURIDAD_TLS_INSEGURO: NODE_TLS_REJECT_UNAUTHORIZED=0 detectado. Se prohíbe el bypass global de TLS en cualquier entorno.`,
    );
  }

  // 3. Blindaje en producción: rol exclusivo cubiora_app y sslmode estricto (verify-full o verify-ca o require)
  if (nodeEnv === 'production') {
    if (varName === 'DATABASE_URL') {
      const username = decodeURIComponent(parsedUrl.username);
      if (username !== 'cubiora_app') {
        throw new Error(
          `[Seguridad] ERROR_SEGURIDAD_ROL_INVALIDO: En producción, DATABASE_URL debe utilizar exclusivamente el rol 'cubiora_app'. Rol detectado: '${username}'.`,
        );
      }
    }

    const sslmode = parsedUrl.searchParams.get('sslmode')?.toLowerCase();
    const validSslModes = ['verify-full', 'verify-ca', 'require'];
    if (!sslmode || !validSslModes.includes(sslmode)) {
      throw new Error(
        `[Seguridad] ERROR_SEGURIDAD_SSL_REQUERIDO: En producción, ${varName} debe incluir el parámetro 'sslmode=verify-full' o 'verify-ca' con verificación de certificado activo.`,
      );
    }
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // Base de datos
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
    DIRECT_URL: z.string().min(1, 'DIRECT_URL es obligatorio'),

    // Seguridad
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
    DISPLAY_TOKEN: z
      .string()
      .min(32, 'DISPLAY_TOKEN debe tener al menos 32 caracteres')
      .default('display_token_default_local_min_32_chars!'),
    CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS es obligatorio'),

    // Logging
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .default('info'),

    // Negocio
    NO_SHOW_MAX_CALLS: z.coerce.number().int().min(1).max(10).default(3),
  })
  .superRefine((data, ctx) => {
    try {
      assertDatabaseUrlSecurity(data.DATABASE_URL, 'DATABASE_URL', data.NODE_ENV);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : String(err),
        path: ['DATABASE_URL'],
      });
    }

    try {
      assertDatabaseUrlSecurity(data.DIRECT_URL, 'DIRECT_URL', data.NODE_ENV);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : String(err),
        path: ['DIRECT_URL'],
      });
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
