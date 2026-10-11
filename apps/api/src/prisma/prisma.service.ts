import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
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

    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
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
