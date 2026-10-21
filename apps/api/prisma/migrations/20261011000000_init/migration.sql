-- ==============================================================================
-- CUBIORA - MIGRACION INICIAL 0001_init (PostgreSQL 18)
-- Alcance exacto: 7 tablas + Tipos + Indices + Triggers WORM + Restricciones CHECK
-- ==============================================================================

-- 1. Asegurar rol propietario
SET ROLE cubiora_owner;

-- 2. Tipos Enumerados Nativos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('RECEPTION', 'CASHIER', 'ADMIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CubicleStatus') THEN
    CREATE TYPE "CubicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CALLING', 'BUSY', 'INACTIVE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketStatus') THEN
    CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'ASSIGNED', 'CALLED', 'IN_SERVICE', 'CLOSED', 'NO_SHOW', 'CANCELLED');
  END IF;
END $$;

-- 3. Tabla: users
CREATE TABLE IF NOT EXISTS "users" (
    "id" VARCHAR(26) NOT NULL,
    "public_id" VARCHAR(26) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RECEPTION',
    "cubicle_id" VARCHAR(26),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_public_id_key" ON "users"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- 4. Tabla: cubicles
CREATE TABLE IF NOT EXISTS "cubicles" (
    "id" VARCHAR(26) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "status" "CubicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cubicles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cubicles_code_key" ON "cubicles"("code");
-- NOTA TECNICA: Se elimina explicitamente ix_cubicles_status_active para no interferir con HOT updates en cubicles.

-- 5. Tabla: system_sequences
CREATE TABLE IF NOT EXISTS "system_sequences" (
    "sequence_name" VARCHAR(50) NOT NULL,
    "next_value" BIGINT NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_sequences_pkey" PRIMARY KEY ("sequence_name")
);

-- 6. Tabla: tickets
CREATE TABLE IF NOT EXISTS "tickets" (
    "id" VARCHAR(26) NOT NULL,
    "public_id" VARCHAR(26) NOT NULL,
    "sequence_number" BIGINT NOT NULL,
    "public_code" VARCHAR(20) NOT NULL,
    "patient_name" VARCHAR(100) NOT NULL,
    "patient_document" VARCHAR(30),
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "cubicle_id" VARCHAR(26),
    "created_by" VARCHAR(26) NOT NULL,
    "assigned_at" TIMESTAMPTZ(3),
    "called_at" TIMESTAMPTZ(3),
    "service_started_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "terminal_reason" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_tickets_cubicle" FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fk_tickets_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tickets_public_id_key" ON "tickets"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_sequence_number_key" ON "tickets"("sequence_number");
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_public_code_key" ON "tickets"("public_code");

-- Indice parcial unico: un solo ticket activo por cubiculo
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ticket_active_per_cubicle" ON "tickets" ("cubicle_id")
  WHERE status IN ('ASSIGNED', 'CALLED', 'IN_SERVICE');

-- Indice FIFO de cola optimizado
CREATE INDEX IF NOT EXISTS "ix_tickets_fifo_queue" ON "tickets" ("created_at", "sequence_number", "id")
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS "ix_tickets_cubicle_status" ON "tickets" ("cubicle_id", "status");
CREATE INDEX IF NOT EXISTS "ix_tickets_document_status" ON "tickets" ("patient_document", "status");

-- Restricciones CHECK completas de coherencia de estados
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "chk_tickets_status_lifecycle";
ALTER TABLE "tickets" ADD CONSTRAINT "chk_tickets_status_lifecycle" CHECK (
  (status = 'PENDING' AND cubicle_id IS NULL AND assigned_at IS NULL AND called_at IS NULL AND service_started_at IS NULL AND closed_at IS NULL)
  OR
  (status = 'ASSIGNED' AND cubicle_id IS NOT NULL AND assigned_at IS NOT NULL AND called_at IS NULL AND service_started_at IS NULL AND closed_at IS NULL)
  OR
  (status = 'CALLED' AND cubicle_id IS NOT NULL AND assigned_at IS NOT NULL AND called_at IS NOT NULL AND service_started_at IS NULL AND closed_at IS NULL)
  OR
  (status = 'IN_SERVICE' AND cubicle_id IS NOT NULL AND assigned_at IS NOT NULL AND called_at IS NOT NULL AND service_started_at IS NOT NULL AND closed_at IS NULL)
  OR
  (status = 'CLOSED' AND cubicle_id IS NOT NULL AND assigned_at IS NOT NULL AND called_at IS NOT NULL AND service_started_at IS NOT NULL AND closed_at IS NOT NULL)
  OR
  (status = 'NO_SHOW' AND cubicle_id IS NOT NULL AND assigned_at IS NOT NULL AND called_at IS NOT NULL AND closed_at IS NOT NULL)
  OR
  (status = 'CANCELLED' AND closed_at IS NOT NULL)
);

-- 7. Tabla: ticket_status_history (Inmutable WORM)
CREATE TABLE IF NOT EXISTS "ticket_status_history" (
    "id" VARCHAR(26) NOT NULL,
    "ticket_id" VARCHAR(26) NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "cubicle_id" VARCHAR(26),
    "actor_user_id" VARCHAR(26),
    "reason_code" VARCHAR(50),
    "correlation_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_status_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_history_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_history_cubicle" FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fk_history_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_history_ticket_time" ON "ticket_status_history" ("ticket_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "ix_history_time" ON "ticket_status_history" ("created_at", "id");

-- 8. Tabla: ticket_calls (Inmutable WORM)
CREATE TABLE IF NOT EXISTS "ticket_calls" (
    "id" VARCHAR(26) NOT NULL,
    "ticket_id" VARCHAR(26) NOT NULL,
    "cubicle_id" VARCHAR(26) NOT NULL,
    "called_by" VARCHAR(26) NOT NULL,
    "call_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_calls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_calls_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_calls_cubicle" FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_calls_caller" FOREIGN KEY ("called_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ticket_calls_call_number" ON "ticket_calls" ("ticket_id", "call_number");
CREATE INDEX IF NOT EXISTS "ix_calls_recent" ON "ticket_calls" ("created_at", "id");

-- 9. Tabla: idempotency_keys
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
    "id" VARCHAR(26) NOT NULL,
    "actor_user_id" VARCHAR(26) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_public_id" VARCHAR(26),
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_idempotency_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_idempotency_key" ON "idempotency_keys" ("actor_user_id", "operation", "idempotency_key");
CREATE INDEX IF NOT EXISTS "ix_idempotency_expiry" ON "idempotency_keys" ("expires_at");

-- 10. Triggers WORM de Inmutabilidad Estricta
CREATE OR REPLACE FUNCTION trg_prevent_history_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'TABLA_INMUTABLE_WORM: Operacion % prohibida en tabla historica %', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_prevent_history_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'TABLA_INMUTABLE_WORM: TRUNCATE prohibido en tabla historica %', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_worm_status_history_row ON "ticket_status_history";
CREATE TRIGGER trg_worm_status_history_row
BEFORE UPDATE OR DELETE ON "ticket_status_history"
FOR EACH ROW EXECUTE FUNCTION trg_prevent_history_modification();

DROP TRIGGER IF EXISTS trg_worm_status_history_stmt ON "ticket_status_history";
CREATE TRIGGER trg_worm_status_history_stmt
BEFORE TRUNCATE ON "ticket_status_history"
FOR EACH STATEMENT EXECUTE FUNCTION trg_prevent_history_truncate();

DROP TRIGGER IF EXISTS trg_worm_calls_row ON "ticket_calls";
CREATE TRIGGER trg_worm_calls_row
BEFORE UPDATE OR DELETE ON "ticket_calls"
FOR EACH ROW EXECUTE FUNCTION trg_prevent_history_modification();

DROP TRIGGER IF EXISTS trg_worm_calls_stmt ON "ticket_calls";
CREATE TRIGGER trg_worm_calls_stmt
BEFORE TRUNCATE ON "ticket_calls"
FOR EACH STATEMENT EXECUTE FUNCTION trg_prevent_history_truncate();

-- 11. Trigger de actualizacion de timestamps (fuente de verdad en DB)
CREATE OR REPLACE FUNCTION trg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON "users";
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

DROP TRIGGER IF EXISTS trg_cubicles_updated_at ON "cubicles";
CREATE TRIGGER trg_cubicles_updated_at
BEFORE UPDATE ON "cubicles"
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

DROP TRIGGER IF EXISTS trg_system_sequences_updated_at ON "system_sequences";
CREATE TRIGGER trg_system_sequences_updated_at
BEFORE UPDATE ON "system_sequences"
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON "tickets";
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON "tickets"
FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
