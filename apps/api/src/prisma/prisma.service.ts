import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getEnv } from '../config/env.validation';
import {
  loadInstitutionalCaCert,
  normalizePemCertificate,
} from '../common/utils/tls-ca.util';

export { normalizePemCertificate } from '../common/utils/tls-ca.util';

export interface ResolvedPgPoolOptions {
  connectionString: string;
  ssl: { rejectUnauthorized: boolean; ca?: string } | undefined;
}

/**
 * Resuelve la cadena de conexión saneada y la configuración TLS para `pg.Pool`.
 * En producción (`NODE_ENV === 'production'`) rechaza `ALLOW_DOCKER_INTERNAL_DB=true`,
 * `sslmode=disable` y cualquier configuración sin certificado CA institucional verificable.
 */
export function resolvePgPoolOptions(
  databaseUrl: string,
  nodeEnv: string,
  allowDockerInternalDb: boolean,
  caCert?: string,
): ResolvedPgPoolOptions {
  const normalizedCaCert = caCert ? normalizePemCertificate(caCert) : undefined;
  const effectiveCaCert =
    normalizedCaCert && normalizedCaCert.length > 0 ? normalizedCaCert : undefined;
  const lowerDbUrl = databaseUrl.toLowerCase();
  const sslDisabled = lowerDbUrl.includes('sslmode=disable');
  const urlRequestsSsl =
    lowerDbUrl.includes('sslmode=require') ||
    lowerDbUrl.includes('sslmode=verify-ca') ||
    lowerDbUrl.includes('sslmode=verify-full');

  if (nodeEnv === 'production') {
    if (allowDockerInternalDb) {
      throw new Error(
        'FATAL_TLS_VERIFICATION_FAILED: ALLOW_DOCKER_INTERNAL_DB=true está estrictamente prohibido en producción. Utilice TLS verify-full con certificado CA institucional.',
      );
    }
    if (sslDisabled || !effectiveCaCert) {
      throw new Error(
        'FATAL_TLS_VERIFICATION_FAILED: En producción es obligatorio el uso de TLS con CA interna verificada (rejectUnauthorized: true, verify-full). La API se niega a iniciar.',
      );
    }
  }

  const requiresStrictSsl = !allowDockerInternalDb && (urlRequestsSsl || nodeEnv === 'production');

  let ssl: { rejectUnauthorized: boolean; ca?: string } | undefined;
  if (allowDockerInternalDb) {
    ssl = sslDisabled ? undefined : { rejectUnauthorized: false };
  } else if (requiresStrictSsl) {
    if (effectiveCaCert) {
      ssl = { rejectUnauthorized: true, ca: effectiveCaCert };
    } else if (nodeEnv !== 'production' && lowerDbUrl.includes('sslmode=require')) {
      ssl = { rejectUnauthorized: false };
    } else {
      ssl = { rejectUnauthorized: true };
    }
  }

  const sanitizedConnectionString = databaseUrl
    .replace(/([?&])sslmode=[^&]+(&|$)/gi, '$1')
    .replace(/[?&]$/, '');

  return {
    connectionString: sanitizedConnectionString,
    ssl,
  };
}

/**
 * PrismaService: envuelve PrismaClient con el driver adapter @prisma/adapter-pg
 * y gestiona el ciclo de vida de la conexión.
 *
 * Prisma 7 requiere un driver adapter explícito; ya no se admite new PrismaClient()
 * sin adapter para PostgreSQL.
 *
 * Separación de roles:
 * - DATABASE_URL   → usuario cubiora_app (runtime: SELECT, INSERT, UPDATE, DELETE)
 * - DIRECT_URL     → usuario cubiora_migrator (migraciones: DDL)
 *   DIRECT_URL solo se usa por la CLI de Prisma, no por este servicio en runtime.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const env = getEnv();

    // ─── Configuración de CA Interna y TLS Estricto ─────────────────────────
    const caCert = loadInstitutionalCaCert();

    const isDockerInternal = process.env['ALLOW_DOCKER_INTERNAL_DB'] === 'true';
    const pgOptions = resolvePgPoolOptions(
      env.DATABASE_URL,
      env.NODE_ENV,
      isDockerInternal,
      caCert,
    );

    const pool = new Pool({
      connectionString: pgOptions.connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: pgOptions.ssl,
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });

    // Guardar referencia para poder cerrar el pool en onModuleDestroy
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma conectado a la base de datos (runtime)');
    } catch (err) {
      this.logger.warn(
        `Base de datos no disponible al iniciar: ${(err as Error)?.message}. /ready reportará 503 hasta restablecer conexión.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Prisma desconectado de la base de datos');
  }

  /**
   * Ejecuta un SELECT 1 para verificar que la BD responde.
   * Usado por el endpoint /health/ready.
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Consulta pg_stat_ssl de la conexión activa y reporta parámetros TLS
   * garantizando cero exposición de secretos o credenciales.
   */
  async getSslStatus(): Promise<{
    ssl: boolean;
    version: string | null;
    cipher: string | null;
    bits: number | null;
  }> {
    try {
      const rows = await this.$queryRaw<
        Array<{ ssl: boolean; version: string | null; cipher: string | null; bits: number | null }>
      >`SELECT ssl, version, cipher, bits FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;
      const firstRow = rows && rows.length > 0 ? rows[0] : null;
      if (firstRow) {
        return firstRow;
      }
      return { ssl: false, version: null, cipher: null, bits: null };
    } catch {
      return { ssl: false, version: null, cipher: null, bits: null };
    }
  }
}
