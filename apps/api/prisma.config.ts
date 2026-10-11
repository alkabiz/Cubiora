import * as dotenv from 'dotenv';
import * as path from 'path';
import { defineConfig } from 'prisma/config';

// Carga prioritaria de variables locales ignoradas por git
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env.development.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const connectionUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionUrl) {
  throw new Error(
    '❌ ERROR CONFIGURACIÓN PRISMA: La variable DIRECT_URL (o DATABASE_URL) es obligatoria y no está definida en el entorno.',
  );
}

// Guarda de seguridad: en desarrollo o pruebas, la CLI solo puede apuntar a localhost
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'production') {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionUrl);
  } catch {
    throw new Error('❌ ERROR CONFIGURACIÓN PRISMA: La cadena de conexión no es una URL válida.');
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(
      `❌ ERROR_SEGURIDAD_HOST_NO_LOCAL: Prisma CLI solo puede operar contra localhost, 127.0.0.1 o ::1 en entorno '${nodeEnv}'. Host detectado: '${host}'. Conexión externa o remota terminantemente prohibida.`,
    );
  }
}

/**
 * Configuración oficial de Prisma 7 (prisma.config.ts)
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: connectionUrl,
  },
});
