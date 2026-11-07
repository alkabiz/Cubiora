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

echo "==> [1/3] Sincronizando esquema de base de datos con Prisma..."
# Sincroniza las tablas y columnas (incluyendo DispensationRecord y enums de farmacia)
pnpm --filter api exec prisma db push --accept-data-loss=false --skip-generate

# Ejecución opcional de seed para inicializar topología y datos institucionales
if [ "$RUN_SEED_ON_BOOT" = "true" ]; then
  echo "==> [2/3] Variable RUN_SEED_ON_BOOT=true detectada. Ejecutando seed idempotente..."
  ALLOW_SEED_IN_PRODUCTION=true pnpm --filter api prisma:seed || echo "⚠️ Advertencia: Error en seed o datos ya aprovisionados previamente."
else
  echo "==> [2/3] RUN_SEED_ON_BOOT no está activo. Omitiendo seed automático."
fi

echo "==> [3/3] Iniciando servidor NestJS en puerto ${PORT:-3000} [${NODE_ENV:-production}]..."
exec node apps/api/dist/main.js
