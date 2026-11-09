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

# Determinar URL para operaciones DDL (Prisma db push / migraciones)
# Si DIRECT_URL está definida y no vacía, se utiliza (cubiora_migrator).
# De lo contrario, se usa DATABASE_URL.
MIGRATION_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "==> [1/3] Sincronizando esquema de base de datos con Prisma..."
if [ -n "$DIRECT_URL" ]; then
  echo "    Utilizando DIRECT_URL (rol migrador DDL) para sincronización de esquema."
fi

# Sincroniza las tablas y columnas (incluyendo DispensationRecord y enums de farmacia)
DATABASE_URL="$MIGRATION_URL" DIRECT_URL="$MIGRATION_URL" pnpm --filter api exec prisma db push --url "$MIGRATION_URL" --accept-data-loss

# Ejecución opcional de seed para inicializar topología y datos institucionales
if [ "$RUN_SEED_ON_BOOT" = "true" ]; then
  echo "==> [2/3] Variable RUN_SEED_ON_BOOT=true detectada. Ejecutando seed idempotente..."
  DATABASE_URL="$MIGRATION_URL" DIRECT_URL="$MIGRATION_URL" ALLOW_SEED_IN_PRODUCTION=true pnpm --filter api prisma:seed || echo "⚠️ Advertencia: Error en seed o datos ya aprovisionados previamente."
else
  echo "==> [2/3] RUN_SEED_ON_BOOT no está activo. Omitiendo seed automático."
fi

echo "==> [3/3] Iniciando servidor NestJS en puerto ${PORT:-3000} [${NODE_ENV:-production}]..."
exec node apps/api/dist/main.js
