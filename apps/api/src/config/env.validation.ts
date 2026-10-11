/**
 * Validación tipada de variables de entorno al arrancar.
 * Si falta alguna variable obligatoria, la aplicación falla inmediatamente
 * con un mensaje claro (fail-fast).
 *
 * Usa Zod 4 para parsing y validación.
 */
import { z } from 'zod/v4';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Base de datos
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL es obligatorio'),

  // Seguridad
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS es obligatorio'),

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // Negocio
  NO_SHOW_MAX_CALLS: z.coerce.number().int().min(1).max(10).default(3),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parsea y valida las variables de entorno.
 * Lanzar en el arranque de la aplicación (main.ts antes de NestFactory.create).
 * @throws {ZodError} Si alguna variable falta o tiene formato incorrecto.
 */
export function validateEnv(): AppEnv {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = z.prettifyError(result.error);
    throw new Error(
      `[Config] Variables de entorno inválidas:\n${issues}`,
    );
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
