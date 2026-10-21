import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getEnv } from '../config/env.validation';

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
    let caCert: string | undefined;
    const caCertPath = process.env['DATABASE_CA_CERT_PATH'] || path.resolve(process.cwd(), 'ca-cert.crt');
    const caCertPathAlt = path.resolve(process.cwd(), 'apps/api/ca-cert.crt');

    if (fs.existsSync(caCertPath)) {
      caCert = fs.readFileSync(caCertPath, 'utf8');
    } else if (fs.existsSync(caCertPathAlt)) {
      caCert = fs.readFileSync(caCertPathAlt, 'utf8');
    } else if (process.env['DATABASE_CA_CERT']) {
      caCert = process.env['DATABASE_CA_CERT'];
    }

    const requiresSsl =
      env.DATABASE_URL.includes('sslmode=require') ||
      env.DATABASE_URL.includes('sslmode=verify-ca') ||
      env.DATABASE_URL.includes('sslmode=verify-full') ||
      env.NODE_ENV === 'production';

    // Validación de inicio obligatoria:
    // Si NODE_ENV=production y TLS no verifica el certificado, la API debe negarse a iniciar.
    if (env.NODE_ENV === 'production') {
      if (!requiresSsl || !caCert) {
        throw new Error(
          'FATAL_TLS_VERIFICATION_FAILED: En producción es obligatorio el uso de TLS con CA interna verificada (rejectUnauthorized: true, verify-full). La API se niega a iniciar.',
        );
      }
    }

    const sslConfig = requiresSsl
      ? {
          rejectUnauthorized: true,
          ca: caCert,
        }
      : undefined;

    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: sslConfig,
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
}
