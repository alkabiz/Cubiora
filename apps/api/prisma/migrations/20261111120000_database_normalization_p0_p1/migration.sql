-- ==============================================================================
-- CUBIORA: NORMALIZACIÓN DE ESQUEMA, INTEGRIDAD REFERENCIAL, TRIGGERS Y CHECKS (P0 + P1)
-- ==============================================================================

-- 1. Integridad WORM en dispensation_records: Restrict en ticket y FK formal hacia users
ALTER TABLE "dispensation_records" DROP CONSTRAINT IF EXISTS "dispensation_records_ticket_id_fkey";
ALTER TABLE "dispensation_records" ADD CONSTRAINT "dispensation_records_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ix_dispensations_operator" ON "dispensation_records"("operator_user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispensation_records_operator_user_id_fkey') THEN
    ALTER TABLE "dispensation_records" ADD CONSTRAINT "dispensation_records_operator_user_id_fkey"
      FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Pertenencia explícita de sede en tickets (multisede + backfill histórico)
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "facility_id" VARCHAR(26);

UPDATE "tickets" t
SET "facility_id" = COALESCE(
  (SELECT c."facility_id" FROM "cubicles" c WHERE c."id" = t."cubicle_id"),
  (SELECT f."id" FROM "facilities" f WHERE f."is_primary" = true ORDER BY f."code" ASC LIMIT 1),
  (SELECT f."id" FROM "facilities" f WHERE f."code" = 'SEDE-CEN-01' LIMIT 1)
)
WHERE t."facility_id" IS NULL;

CREATE INDEX IF NOT EXISTS "ix_tickets_facility_queue"
  ON "tickets"("facility_id", "status", "queue_category", "sequence_number");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_facility_id_fkey') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_facility_id_fkey"
      FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Eliminación de transitividad cíclica Pharmacist -> Cubicle -> Facility (FK compuesta BCNF)
CREATE UNIQUE INDEX IF NOT EXISTS "cubicles_id_facility_id_key"
  ON "cubicles"("id", "facility_id");

UPDATE "pharmacists" p
SET "facility_id" = c."facility_id"
FROM "cubicles" c
WHERE p."cubicle_id" = c."id"
  AND c."facility_id" IS NOT NULL
  AND p."facility_id" IS DISTINCT FROM c."facility_id";

ALTER TABLE "pharmacists" DROP CONSTRAINT IF EXISTS "pharmacists_cubicle_id_fkey";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacists_cubicle_id_facility_id_fkey') THEN
    ALTER TABLE "pharmacists" ADD CONSTRAINT "pharmacists_cubicle_id_facility_id_fkey"
      FOREIGN KEY ("cubicle_id", "facility_id") REFERENCES "cubicles"("id", "facility_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Índices únicos parciales (sede primaria única y nombres de ventanilla únicos por sede)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_facilities_single_primary"
  ON "facilities" ("is_primary") WHERE "is_primary" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_cubicles_facility_display_name"
  ON "cubicles" ("facility_id", "display_name") WHERE "facility_id" IS NOT NULL;

-- 5. Triggers de actualización automática de updated_at en facilities y pharmacists
DROP TRIGGER IF EXISTS trg_facilities_updated_at ON "facilities";
CREATE TRIGGER trg_facilities_updated_at
BEFORE UPDATE ON "facilities"
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

DROP TRIGGER IF EXISTS trg_pharmacists_updated_at ON "pharmacists";
CREATE TRIGGER trg_pharmacists_updated_at
BEFORE UPDATE ON "pharmacists"
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

-- 6. Restricciones CHECK de dominio e invariantes contables/regulatorias
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_dispensation_counts_non_negative') THEN
    ALTER TABLE "dispensation_records" ADD CONSTRAINT "chk_dispensation_counts_non_negative"
      CHECK ("items_delivered_count" >= 0 AND "items_pending_count" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_dispensation_pending_deadline') THEN
    ALTER TABLE "dispensation_records" ADD CONSTRAINT "chk_dispensation_pending_deadline"
      CHECK ("resolution" <> 'PENDING_48H' OR "delivery_deadline" IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pharmacists_dispatches_non_negative') THEN
    ALTER TABLE "pharmacists" ADD CONSTRAINT "chk_pharmacists_dispatches_non_negative"
      CHECK ("dispatches_count" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_facilities_cubicles_non_negative') THEN
    ALTER TABLE "facilities" ADD CONSTRAINT "chk_facilities_cubicles_non_negative"
      CHECK ("enabled_cubicles_count" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tickets_public_code_format') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "chk_tickets_public_code_format"
      CHECK ("public_code" ~ '^TUR-[0-9]{6}-(GE|PR|ES|HC|FA)$');
  END IF;
END $$;

