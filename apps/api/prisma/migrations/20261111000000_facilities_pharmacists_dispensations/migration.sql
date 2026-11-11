-- ==============================================================================
-- CUBIORA: TABLAS DE SEDES, FARMACÉUTICOS, DISPENSACIONES Y COLUMNAS DELTA (2/2)
-- Formaliza en Prisma Migrate el delta previamente aplicado vía db push.
-- ==============================================================================

-- 1. Tabla: facilities
CREATE TABLE IF NOT EXISTS "facilities" (
    "id" VARCHAR(26) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "opening_hours" VARCHAR(80) NOT NULL,
    "enabled_cubicles_count" INTEGER NOT NULL DEFAULT 4,
    "status" "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "facilities_code_key" ON "facilities"("code");

-- 2. Columnas e índice en cubicles
ALTER TABLE "cubicles" ADD COLUMN IF NOT EXISTS "operator_name" VARCHAR(120);
ALTER TABLE "cubicles" ADD COLUMN IF NOT EXISTS "allowed_categories" "QueueCategory"[] DEFAULT ARRAY['GENERAL', 'PREFERENTIAL', 'HIGH_COST', 'BILLING']::"QueueCategory"[];
ALTER TABLE "cubicles" ADD COLUMN IF NOT EXISTS "facility_id" VARCHAR(26);

CREATE INDEX IF NOT EXISTS "ix_cubicles_facility" ON "cubicles"("facility_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cubicles_facility_id_fkey') THEN
    ALTER TABLE "cubicles" ADD CONSTRAINT "cubicles_facility_id_fkey"
      FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Tabla: pharmacists
CREATE TABLE IF NOT EXISTS "pharmacists" (
    "id" VARCHAR(26) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "license_number" VARCHAR(40) NOT NULL,
    "operational_role" "PharmacistOperationalRole" NOT NULL DEFAULT 'TITULAR',
    "shift" "WorkShift" NOT NULL DEFAULT 'MORNING',
    "status" "PharmacistStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "dispatches_count" INTEGER NOT NULL DEFAULT 0,
    "facility_id" VARCHAR(26),
    "cubicle_id" VARCHAR(26),
    "user_id" VARCHAR(26),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pharmacists_license_number_key" ON "pharmacists"("license_number");
CREATE UNIQUE INDEX IF NOT EXISTS "pharmacists_email_key" ON "pharmacists"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "pharmacists_user_id_key" ON "pharmacists"("user_id");
CREATE INDEX IF NOT EXISTS "ix_pharmacists_facility" ON "pharmacists"("facility_id");
CREATE INDEX IF NOT EXISTS "ix_pharmacists_cubicle" ON "pharmacists"("cubicle_id");
CREATE INDEX IF NOT EXISTS "ix_pharmacists_status" ON "pharmacists"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacists_facility_id_fkey') THEN
    ALTER TABLE "pharmacists" ADD CONSTRAINT "pharmacists_facility_id_fkey"
      FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacists_cubicle_id_fkey') THEN
    ALTER TABLE "pharmacists" ADD CONSTRAINT "pharmacists_cubicle_id_fkey"
      FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacists_user_id_fkey') THEN
    ALTER TABLE "pharmacists" ADD CONSTRAINT "pharmacists_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Columna e índice de fórmula médica en tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "prescription_barcode" VARCHAR(60);
CREATE INDEX IF NOT EXISTS "ix_tickets_prescription" ON "tickets"("prescription_barcode");

-- 5. Tabla: dispensation_records
CREATE TABLE IF NOT EXISTS "dispensation_records" (
    "id" VARCHAR(26) NOT NULL,
    "ticket_id" VARCHAR(26) NOT NULL,
    "cubicle_id" VARCHAR(26) NOT NULL,
    "operator_user_id" VARCHAR(26) NOT NULL,
    "resolution" "DispensationResolution" NOT NULL,
    "prescription_code" VARCHAR(60),
    "mipres_number" VARCHAR(60),
    "items_delivered_count" INTEGER NOT NULL DEFAULT 0,
    "items_pending_count" INTEGER NOT NULL DEFAULT 0,
    "pending_details_json" JSONB,
    "delivery_address" VARCHAR(255),
    "delivery_phone" VARCHAR(30),
    "delivery_deadline" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispensation_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dispensation_records_ticket_id_key" ON "dispensation_records"("ticket_id");
CREATE INDEX IF NOT EXISTS "ix_dispensations_pending_deadline" ON "dispensation_records"("resolution", "delivery_deadline");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispensation_records_ticket_id_fkey') THEN
    ALTER TABLE "dispensation_records" ADD CONSTRAINT "dispensation_records_ticket_id_fkey"
      FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispensation_records_cubicle_id_fkey') THEN
    ALTER TABLE "dispensation_records" ADD CONSTRAINT "dispensation_records_cubicle_id_fkey"
      FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

