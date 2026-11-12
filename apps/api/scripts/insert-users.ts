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

// Prohibición estricta de pasar credenciales por línea de comandos (expone secretos en ps / argv)
if (process.argv.some((arg) => arg.startsWith('--url='))) {
  console.error('❌ ERROR_SEGURIDAD_CLI_SECRET: No pase credenciales mediante --url=. Use únicamente variables de entorno DIRECT_URL o DATABASE_URL.');
  process.exit(1);
}

const rawConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!rawConnectionString) {
  console.error('❌ ERROR_CONFIGURACION: DIRECT_URL o DATABASE_URL no fue encontrada en el entorno.');
  process.exit(1);
}

try {
  const parsedHost = new URL(rawConnectionString).hostname.toLowerCase();
  if (
    process.env.NODE_ENV !== 'production' &&
    !['localhost', '127.0.0.1', '::1', 'postgres'].includes(parsedHost)
  ) {
    console.error(
      `❌ ERROR_SEGURIDAD_HOST_NO_LOCAL: insert-users.ts solo puede apuntar a localhost/127.0.0.1/::1/postgres fuera de producción. Host: '${parsedHost}'.`,
    );
    process.exit(1);
  }
} catch {
  console.error('❌ ERROR_CONFIGURACION: La URL de conexión no tiene un formato válido.');
  process.exit(1);
}

// Carga de certificado CA
const normalizePemCertificate = (rawCert: string): string => {
  let normalized = rawCert.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
};

let caCert: string | undefined;
const explicitCaPath = (
  process.env.DATABASE_CA_CERT_PATH ||
  process.env.CA_CERT_PATH ||
  ''
).trim();
const explicitCaCert = (
  process.env.DATABASE_CA_CERT ||
  process.env.CA_CERT ||
  ''
).trim();

if (explicitCaPath && fs.existsSync(explicitCaPath)) {
  const filePem = normalizePemCertificate(fs.readFileSync(explicitCaPath, 'utf8'));
  if (filePem.length > 0) {
    caCert = filePem;
  }
}

if (!caCert && explicitCaCert) {
  const inlinePem = normalizePemCertificate(explicitCaCert);
  if (inlinePem.length > 0) {
    caCert = inlinePem;
  }
}

if (!caCert && !explicitCaPath) {
  for (const candidate of [
    path.resolve(__dirname, '../ca-cert.crt'),
    path.resolve(process.cwd(), 'ca-cert.crt'),
  ]) {
    if (fs.existsSync(candidate)) {
      const defaultPem = normalizePemCertificate(fs.readFileSync(candidate, 'utf8'));
      if (defaultPem.length > 0) {
        caCert = defaultPem;
        break;
      }
    }
  }
}

const requiresSsl =
  rawConnectionString.includes('sslmode=require') ||
  rawConnectionString.includes('sslmode=verify-ca') ||
  rawConnectionString.includes('sslmode=verify-full') ||
  process.env.NODE_ENV === 'production';

const allowDockerInternalDb = process.env.ALLOW_DOCKER_INTERNAL_DB === 'true';

if (process.env.NODE_ENV === 'production' && (allowDockerInternalDb || !caCert)) {
  console.error('❌ ERROR_SEGURIDAD_TLS: En producción se exige certificado CA institucional y se prohíbe ALLOW_DOCKER_INTERNAL_DB=true.');
  process.exit(1);
}

function buildPoolConfig(connStr: string, sslRequired: boolean, ca?: string): PoolConfig {
  const match = connStr.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/:]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/);
  const sslConfig =
    allowDockerInternalDb && process.env.NODE_ENV !== 'production'
      ? { rejectUnauthorized: false }
      : sslRequired
        ? ca
          ? { rejectUnauthorized: true, ca }
          : { rejectUnauthorized: true }
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

    // Hashes individuales con bcrypt (10 rounds) sin secretos predeterminados ni sal compartida
    const FORBIDDEN_PASSWORDS = new Set([
      'admin2026!*',
      'password',
      'password123',
      '12345678',
      'cubiora123',
      'admin1234',
    ]);
    const unifiedPassword = process.env.DEV_SEED_USER_PASSWORD;
    const cajeroPassword = process.env.SEED_CAJERO_PASSWORD || unifiedPassword;
    const receptorPassword = process.env.SEED_RECEPTOR_PASSWORD || unifiedPassword;
    const minLen = process.env.NODE_ENV === 'production' ? 12 : 8;

    if (
      !cajeroPassword ||
      cajeroPassword.length < minLen ||
      !receptorPassword ||
      receptorPassword.length < minLen ||
      FORBIDDEN_PASSWORDS.has(cajeroPassword.toLowerCase()) ||
      FORBIDDEN_PASSWORDS.has(receptorPassword.toLowerCase())
    ) {
      throw new Error(
        `Debe definir DEV_SEED_USER_PASSWORD o SEED_CAJERO_PASSWORD/SEED_RECEPTOR_PASSWORD explícitas y robustas (mínimo ${minLen} caracteres, sin valores de ejemplo como 'Admin2026!*').`,
      );
    }

    const resetExistingPasswords = process.env.RESET_SEED_PASSWORDS === 'true';

    const usersToInsert = [
      {
        id: ulid(),
        publicId: ulid(),
        username: 'cajero',
        displayName: 'Atención Cubículo 01',
        role: 'CASHIER',
        passwordHash: await bcrypt.hash(cajeroPassword, 10),
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'receptor',
        displayName: 'Recepción de Farmacia',
        role: 'RECEPTION',
        passwordHash: await bcrypt.hash(receptorPassword, 10),
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'cajero1',
        displayName: 'Atención Cubículo 1',
        role: 'CASHIER',
        passwordHash: await bcrypt.hash(cajeroPassword, 10),
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'recepcion',
        displayName: 'Recepcionista Turnos',
        role: 'RECEPTION',
        passwordHash: await bcrypt.hash(receptorPassword, 10),
      },
    ];

    for (const u of usersToInsert) {
      const query = resetExistingPasswords
        ? `
        INSERT INTO "users" (
          "id", "public_id", "username", "password_hash", "display_name", "role", "cubicle_id", "active", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6::"UserRole", NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("username") DO UPDATE SET
          "password_hash" = EXCLUDED."password_hash",
          "updated_at"    = CURRENT_TIMESTAMP;
      `
        : `
        INSERT INTO "users" (
          "id", "public_id", "username", "password_hash", "display_name", "role", "cubicle_id", "active", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6::"UserRole", NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("username") DO NOTHING;
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

    // Asignación determinista solo si el operador aún no tiene cubículo asignado.
    const cubicleAssignments = [
      { username: 'cajero', cubicleCode: 'CUB-03' },
      { username: 'cajero1', cubicleCode: 'CUB-01' },
    ];

    for (const assignment of cubicleAssignments) {
      const result = await client.query(
        `
          UPDATE "users" AS u
          SET "cubicle_id" = c."id", "updated_at" = CURRENT_TIMESTAMP
          FROM "cubicles" AS c
          WHERE u."username" = $1
            AND c."code" = $2
            AND u."cubicle_id" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "users" u2 WHERE u2."cubicle_id" = c."id"
            );
        `,
        [assignment.username, assignment.cubicleCode],
      );

      if (result.rowCount === 0) {
        console.log(
          `ℹ️  ${assignment.username} ya tenía cubículo asignado o ${assignment.cubicleCode} no existe.`,
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ Inserción de usuarios completada con éxito.');

    // Verificación
    const result = await client.query(`
      SELECT 
        "id", "public_id", "username", "display_name", "role", "cubicle_id", "active", "created_at"
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
