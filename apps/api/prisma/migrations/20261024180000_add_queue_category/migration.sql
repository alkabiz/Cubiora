-- ==============================================================================
-- CUBIORA: MIGRACIÓN PARA CATEGORÍA OPERATIVA DE COLA (GENERAL / PREFERENTIAL)
-- ==============================================================================

-- 1. Crear tipo enumerado QueueCategory si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QueueCategory') THEN
    CREATE TYPE "QueueCategory" AS ENUM ('GENERAL', 'PREFERENTIAL');
  END IF;
END$$;

-- 2. Añadir columnas a tabla tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "queue_category" "QueueCategory" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "preferential_reason" VARCHAR(100);

-- 3. Crear índice compuesto para ordenamiento operativo y optimización de cola
CREATE INDEX IF NOT EXISTS "ix_tickets_status_category_sequence" ON "tickets"("status", "queue_category", "sequence_number");
