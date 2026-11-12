#!/bin/sh
set -e

echo "================================================================="
echo "  Cubiora API — Arranque en Producción (Coolify Container Engine)"
echo "================================================================="

# Validar que DATABASE_URL esté presente
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: Variable DATABASE_URL no definida en el contenedor."
  exit 1
fi

# Determinar URL para operaciones DDL (Prisma Migrate)
# Si DIRECT_URL está definida y no vacía, se utiliza (cubiora_migrator).
# De lo contrario, se usa DATABASE_URL.
MIGRATION_URL="${DIRECT_URL:-$DATABASE_URL}"

# Materializar certificado CA institucional si llega por path o inline (DATABASE_CA_CERT)
# para que tanto `prisma migrate deploy` (NODE_EXTRA_CA_CERTS / sslrootcert) como Node TLS
# confíen en la CA privada durante el arranque.
CA_FILE=""
if [ -n "${DATABASE_CA_CERT_PATH:-}" ] && [ -f "$DATABASE_CA_CERT_PATH" ]; then
  CA_FILE="$DATABASE_CA_CERT_PATH"
elif [ -n "${CA_CERT_PATH:-}" ] && [ -f "$CA_CERT_PATH" ]; then
  CA_FILE="$CA_CERT_PATH"
elif [ -n "${DATABASE_CA_CERT:-}${CA_CERT:-}" ]; then
  CA_FILE="/tmp/cubiora-db-ca.crt"
  node -e '
    const fs = require("fs");
    let raw = (process.env.DATABASE_CA_CERT || process.env.CA_CERT || "").trim();
    const dq = "\"";
    const sq = String.fromCharCode(39);
    if ((raw.startsWith(dq) && raw.endsWith(dq)) || (raw.startsWith(sq) && raw.endsWith(sq))) {
      raw = raw.slice(1, -1).trim();
    }
    const pem = raw.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
    if (!pem.includes("-----BEGIN CERTIFICATE-----") || !pem.includes("-----END CERTIFICATE-----")) {
      console.error("❌ ERROR_SEGURIDAD_CA_INVALIDA: DATABASE_CA_CERT no contiene un certificado PEM válido.");
      process.exit(1);
    }
    fs.writeFileSync("/tmp/cubiora-db-ca.crt", pem + "\n", { mode: 0o600 });
  '
fi

MIGRATE_COMMAND_URL="$MIGRATION_URL"
if [ -n "$CA_FILE" ]; then
  export NODE_EXTRA_CA_CERTS="$CA_FILE"
  export PGSSLROOTCERT="$CA_FILE"
  MIGRATE_COMMAND_URL="$(MIGRATION_URL_INPUT="$MIGRATION_URL" CA_FILE_INPUT="$CA_FILE" node -e '
    const rawUrl = process.env.MIGRATION_URL_INPUT;
    const caFile = process.env.CA_FILE_INPUT;
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has("sslrootcert")) {
      const sep = rawUrl.includes("?") ? "&" : "?";
      const safePath = /^[A-Za-z0-9_./:-]+$/.test(caFile) ? caFile : encodeURIComponent(caFile);
      process.stdout.write(`${rawUrl}${sep}sslrootcert=${safePath}`);
    } else {
      process.stdout.write(rawUrl);
    }
  ')"
elif [ "${ALLOW_DOCKER_INTERNAL_DB:-false}" = "true" ]; then
  # Cuando se habilita ALLOW_DOCKER_INTERNAL_DB=true sin CA montada (ej. LAN 192.168.1.33),
  # Prisma 7 CLI (pg v8) trata sslmode=require como verify-full; usar sslmode=no-verify evita TlsConnectionError.
  MIGRATE_COMMAND_URL="$(MIGRATION_URL_INPUT="$MIGRATION_URL" node -e '
    const rawUrl = process.env.MIGRATION_URL_INPUT;
    if (/([?&])sslmode=[^&]+/i.test(rawUrl)) {
      process.stdout.write(rawUrl.replace(/([?&])sslmode=[^&]+/i, "$1sslmode=no-verify"));
    } else {
      const sep = rawUrl.includes("?") ? "&" : "?";
      process.stdout.write(`${rawUrl}${sep}sslmode=no-verify`);
    }
  ')"
fi

echo "==> [1/3] Aplicando migraciones formales de Prisma..."
if [ -n "$DIRECT_URL" ]; then
  echo "    Utilizando DIRECT_URL (rol migrador DDL) para migraciones formales."
fi

# Aplica migraciones invocando directamente el binario local de Prisma 7 sin Corepack/pnpm
(
  cd apps/api
  DATABASE_URL="$MIGRATE_COMMAND_URL" DIRECT_URL="$MIGRATE_COMMAND_URL" \
    node ./node_modules/prisma/build/index.js migrate deploy
)

# Ejecución opcional de seed para inicializar topología y datos institucionales (default: false)
if [ "${RUN_SEED_ON_BOOT:-false}" = "true" ]; then
  echo "==> [2/3] Variable RUN_SEED_ON_BOOT=true detectada. Ejecutando seed idempotente (fail-closed)..."
  (
    cd apps/api
    DATABASE_URL="$MIGRATION_URL" DIRECT_URL="$MIGRATION_URL" ALLOW_SEED_IN_PRODUCTION=true \
      node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts
  )
else
  echo "==> [2/3] RUN_SEED_ON_BOOT no está activo (${RUN_SEED_ON_BOOT:-false}). Omitiendo seed automático."
fi

echo "==> [3/3] Iniciando servidor NestJS en puerto ${PORT:-3000} [${NODE_ENV:-production}]..."
exec node apps/api/dist/main.js
