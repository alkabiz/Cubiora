import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 Configuration (prisma.config.ts)
 *
 * En Prisma 7, las cadenas de conexión para la CLI de Prisma y las migraciones
 * se definen aquí, desacopladas del schema.prisma.
 *
 * Separación de privilegios:
 * - Migraciones / CLI: DIRECT_URL (usuario cubiora_migrator con privilegios DDL)
 * - Fallback: DATABASE_URL si DIRECT_URL no está provisto en desarrollo local
 * - Runtime de NestJS: Se conecta mediante PrismaService con DATABASE_URL (usuario cubiora_app con DML)
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      'postgresql://cubiora_migrator:cubiora_dev_password@localhost:5432/cubiora_dev?schema=public',
  },
});
