-- ==============================================================================
-- CUBIORA: ENDURECIMIENTO DE SEGURIDAD Y GOBERNANZA DE BASE DE DATOS (FASE 4)
-- Cobertura: token_version, unicidad farmacéutico-cubículo, WORM dispensaciones y
--            matriz explícita de mínimo privilegio para cubiora_app.
-- ==============================================================================

-- 1. Columna token_version en users (paridad con schema.prisma y revocación de sesiones)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_token_version_non_negative') THEN
    ALTER TABLE "users" ADD CONSTRAINT "chk_users_token_version_non_negative"
      CHECK ("token_version" >= 0);
  END IF;
END $$;

-- 2. Unicidad parcial de farmacéutico asignado por cubículo (cierra race READ COMMITTED #12)
WITH ranked_assignments AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "cubicle_id"
      ORDER BY
        CASE WHEN "status" = 'ACTIVE'::"PharmacistStatus" THEN 0 ELSE 1 END,
        "updated_at" DESC,
        "id" ASC
    ) AS rn
  FROM "pharmacists"
  WHERE "cubicle_id" IS NOT NULL
)
UPDATE "pharmacists" p
SET "cubicle_id" = NULL
FROM ranked_assignments r
WHERE p."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_pharmacists_cubicle_assigned"
  ON "pharmacists" ("cubicle_id") WHERE "cubicle_id" IS NOT NULL;

-- 3. Inmutabilidad WORM en dispensation_records (#30 / MinSalud)
DROP TRIGGER IF EXISTS trg_worm_dispensation_records_row ON "dispensation_records";
CREATE TRIGGER trg_worm_dispensation_records_row
BEFORE UPDATE OR DELETE ON "dispensation_records"
FOR EACH ROW EXECUTE FUNCTION trg_prevent_history_modification();

DROP TRIGGER IF EXISTS trg_worm_dispensation_records_stmt ON "dispensation_records";
CREATE TRIGGER trg_worm_dispensation_records_stmt
BEFORE TRUNCATE ON "dispensation_records"
FOR EACH STATEMENT EXECUTE FUNCTION trg_prevent_history_truncate();

-- 4. Endurecimiento de esquema public y matriz de mínimo privilegio para cubiora_app (#31, H-8)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace n
    WHERE n.nspname = 'public'
      AND pg_has_role(current_user, n.nspowner, 'USAGE')
  ) THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA public FROM PUBLIC';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cubiora_migrator')
     AND pg_has_role(current_user, 'cubiora_migrator', 'USAGE') THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cubiora_app') THEN
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, cubiora_app';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cubiora_app';
    ELSE
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cubiora_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO cubiora_app';

    -- A) Tablas operativas mutables sin DELETE físico
    EXECUTE 'REVOKE ALL ON TABLE "users", "tickets", "system_sequences" FROM PUBLIC, cubiora_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE "users", "tickets", "system_sequences" TO cubiora_app';

    -- B) Tablas de configuración/ciclo de vida gestionado y expiración idempotente
    --    (las entidades referenciadas en tickets/dispensaciones quedan bloqueadas por FK ON DELETE RESTRICT)
    EXECUTE 'REVOKE ALL ON TABLE "idempotency_keys", "facilities", "pharmacists", "cubicles" FROM PUBLIC, cubiora_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "idempotency_keys", "facilities", "pharmacists", "cubicles" TO cubiora_app';

    -- C) Tablas históricas WORM (solo lectura e inserción append-only)
    EXECUTE 'REVOKE ALL ON TABLE "ticket_status_history", "ticket_calls", "dispensation_records" FROM PUBLIC, cubiora_app';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE "ticket_status_history", "ticket_calls", "dispensation_records" TO cubiora_app';

    -- D) Tabla interna de migraciones estrictamente reservada al rol migrador
    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON TABLE "_prisma_migrations" FROM PUBLIC, cubiora_app';
    END IF;

    -- E) Secuencias
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cubiora_app';
  END IF;
END $$;

