-- ==============================================================================
-- CUBIORA: MIGRACIÓN SEGURA DE INTEGRIDAD WORM, RELACIONES E ÍNDICES (3FN)
-- Entorno: PostgreSQL 18 Local (cubiora_db, esquema public)
-- ==============================================================================

-- 1. Coherencia WORM: Todas las FK de ticket_calls y ticket_status_history a ON DELETE RESTRICT
ALTER TABLE "ticket_calls" DROP CONSTRAINT IF EXISTS "fk_calls_ticket";
ALTER TABLE "ticket_calls" DROP CONSTRAINT IF EXISTS "ticket_calls_ticket_id_fkey";
ALTER TABLE "ticket_calls" ADD CONSTRAINT "fk_calls_ticket"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_calls" DROP CONSTRAINT IF EXISTS "fk_calls_cubicle";
ALTER TABLE "ticket_calls" DROP CONSTRAINT IF EXISTS "ticket_calls_cubicle_id_fkey";
ALTER TABLE "ticket_calls" ADD CONSTRAINT "fk_calls_cubicle"
  FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_calls" DROP CONSTRAINT IF EXISTS "fk_calls_caller";
ALTER TABLE "ticket_calls" DROP CONSTRAINT IF EXISTS "ticket_calls_called_by_fkey";
ALTER TABLE "ticket_calls" ADD CONSTRAINT "fk_calls_caller"
  FOREIGN KEY ("called_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_status_history" DROP CONSTRAINT IF EXISTS "fk_history_ticket";
ALTER TABLE "ticket_status_history" DROP CONSTRAINT IF EXISTS "ticket_status_history_ticket_id_fkey";
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "fk_history_ticket"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_status_history" DROP CONSTRAINT IF EXISTS "fk_history_cubicle";
ALTER TABLE "ticket_status_history" DROP CONSTRAINT IF EXISTS "ticket_status_history_cubicle_id_fkey";
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "fk_history_cubicle"
  FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_status_history" DROP CONSTRAINT IF EXISTS "fk_history_actor";
ALTER TABLE "ticket_status_history" DROP CONSTRAINT IF EXISTS "ticket_status_history_actor_user_id_fkey";
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "fk_history_actor"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Relación formal y unicidad de operador en users.cubicle_id (1:1 condicional)
CREATE UNIQUE INDEX IF NOT EXISTS "users_cubicle_id_key" ON "users"("cubicle_id");

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "fk_users_cubicle";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_cubicle_id_fkey";
ALTER TABLE "users" ADD CONSTRAINT "fk_users_cubicle"
  FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Tipado estricto in-place en ticket_status_history usando enum nativo TicketStatus
ALTER TABLE "ticket_status_history"
  ALTER COLUMN "from_status" TYPE "TicketStatus" USING "from_status"::"TicketStatus",
  ALTER COLUMN "to_status" TYPE "TicketStatus" USING "to_status"::"TicketStatus";

-- 4. Índices compuestos para cola FIFO en tiempo real y auditoría
CREATE INDEX IF NOT EXISTS "ix_tickets_status_sequence" ON "tickets"("status", "sequence_number");
CREATE INDEX IF NOT EXISTS "ix_tickets_created_by" ON "tickets"("created_by");
CREATE INDEX IF NOT EXISTS "ix_calls_cubicle_time" ON "ticket_calls"("cubicle_id", "created_at");

-- 5. Restricciones CHECK de calidad de datos en tickets
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "chk_tickets_patient_name_not_empty";
ALTER TABLE "tickets" ADD CONSTRAINT "chk_tickets_patient_name_not_empty"
  CHECK (length(trim("patient_name")) >= 2);

ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "chk_tickets_patient_document_format";
ALTER TABLE "tickets" ADD CONSTRAINT "chk_tickets_patient_document_format"
  CHECK ("patient_document" IS NULL OR length(trim("patient_document")) >= 3);
