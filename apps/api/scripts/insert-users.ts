import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Pool, PoolConfig } from 'pg';
import * as bcrypt from 'bcryptjs';
import { ulid } from 'ulid';

// Carga prioritaria de variables de entorno locales
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });

// Salvaguarda: prohibición estricta de desactivar TLS global
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  console.error('❌ FATAL_SEGURIDAD_TLS: NODE_TLS_REJECT_UNAUTHORIZED=0 está prohibido.');
  process.exit(1);
}

// Argumento de línea de comandos o variable de entorno
const argConn = process.argv.find((arg) => arg.startsWith('--url='))?.replace('--url=', '');
const rawConnectionString = argConn || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!rawConnectionString) {
  console.error('❌ ERROR_CONFIGURACION: DIRECT_URL o DATABASE_URL no fue encontrada en el entorno ni por argumento --url=');
  process.exit(1);
}

// Carga de certificado CA
let caCert: string | undefined;
const caCertPath = process.env.DATABASE_CA_CERT_PATH || path.resolve(__dirname, '../ca-cert.crt');
const caCertPathRoot = path.resolve(process.cwd(), 'ca-cert.crt');

if (fs.existsSync(caCertPath)) {
  caCert = fs.readFileSync(caCertPath, 'utf8');
} else if (fs.existsSync(caCertPathRoot)) {
  caCert = fs.readFileSync(caCertPathRoot, 'utf8');
} else if (process.env.DATABASE_CA_CERT) {
  caCert = process.env.DATABASE_CA_CERT;
}

const requiresSsl =
  rawConnectionString.includes('sslmode=require') ||
  rawConnectionString.includes('sslmode=verify-ca') ||
  rawConnectionString.includes('sslmode=verify-full') ||
  process.env.NODE_ENV === 'production';

// Parseo robusto que tolera caracteres especiales (como '/' o '=') en contraseñas sin romper new URL()
function buildPoolConfig(connStr: string, sslRequired: boolean, ca?: string): PoolConfig {
  const match = connStr.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/:]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/);
  const sslConfig = sslRequired
    ? {
        rejectUnauthorized: true,
        ca,
      }
    : undefined;

  if (match) {
    const [, user, password, host, portStr, database] = match;
    return {
      user: decodeURIComponent(user),
      password: decodeURIComponent(password),
      host,
      port: portStr ? parseInt(portStr, 10) : 5432,
      database,
      ssl: sslConfig,
      connectionTimeoutMillis: 8000,
    };
  }

  // Fallback si no coincide el regex
  const sanitized = connStr.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
  return {
    connectionString: sanitized,
    ssl: sslConfig,
    connectionTimeoutMillis: 8000,
  };
}

const poolConfig = buildPoolConfig(rawConnectionString, requiresSsl, caCert);
const pool = new Pool(poolConfig);

async function main() {
  console.log('📦 Iniciando inserción de usuarios en tabla "users"...');

  let client;
  try {
    client = await pool.connect();
  } catch (connErr: any) {
    console.error('❌ ERROR_CONEXION_BASE_DATOS: No se pudo establecer conexión con PostgreSQL.');
    if (connErr.code === '28P01') {
      console.error('👉 Código 28P01 (Autenticación fallida): La contraseña provista no coincide con la configurada en PostgreSQL para el usuario indicado.');
    } else if (connErr.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      console.error('👉 Error TLS: El certificado del servidor no pudo ser validado con la CA provista.');
    } else {
      console.error(`👉 Detalle del error [${connErr.code || 'UNKNOWN'}]:`, connErr.message);
    }
    process.exit(1);
  }

  try {
    await client.query('BEGIN');

    // Hashes seguros generados con 10 rounds de bcrypt
    const cajeroPassword = process.env.SEED_CAJERO_PASSWORD || 'Cajero2026!*';
    const receptorPassword = process.env.SEED_RECEPTOR_PASSWORD || 'Receptor2026!*';

    const salt = await bcrypt.genSalt(10);
    const hashCajero = await bcrypt.hash(cajeroPassword, salt);
    const hashReceptor = await bcrypt.hash(receptorPassword, salt);

    const usersToInsert = [
      {
        id: ulid(),
        publicId: ulid(),
        username: 'cajero',
        displayName: 'Atención Cubículo 01',
        role: 'CASHIER',
        passwordHash: hashCajero,
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'receptor',
        displayName: 'Recepción de Farmacia',
        role: 'RECEPTION',
        passwordHash: hashReceptor,
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'cajero1',
        displayName: 'Atención Cubículo 1',
        role: 'CASHIER',
        passwordHash: hashCajero,
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'recepcion',
        displayName: 'Recepcionista Turnos',
        role: 'RECEPTION',
        passwordHash: hashReceptor,
      },
    ];

    for (const u of usersToInsert) {
      const query = `
        INSERT INTO "users" (
          "id", "public_id", "username", "password_hash", "display_name", "role", "cubicle_id", "active", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6::"UserRole", NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("username") DO UPDATE SET
          "password_hash" = EXCLUDED."password_hash",
          "display_name"  = EXCLUDED."display_name",
          "role"          = EXCLUDED."role",
          "active"        = true,
          "updated_at"    = CURRENT_TIMESTAMP;
      `;

      await client.query(query, [
        u.id,
        u.publicId,
        u.username,
        u.passwordHash,
        u.displayName,
        u.role,
      ]);
    }

    await client.query('COMMIT');
    console.log('✅ Inserción de usuarios completada con éxito.');

    // Verificación
    const result = await client.query(`
      SELECT 
        "id", "public_id", "username", "display_name", "role", "active", "created_at"
      FROM "users"
      WHERE "username" IN ('cajero', 'receptor', 'cajero1', 'recepcion')
      ORDER BY "role", "username";
    `);

    console.table(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la inserción en la tabla users:', (error as Error).message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => {
  process.exit(1);
});
