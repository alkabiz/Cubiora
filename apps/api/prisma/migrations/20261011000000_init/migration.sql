-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RECEPTION', 'CASHIER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CubicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CALLING', 'BUSY', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'ASSIGNED', 'CALLED', 'IN_SERVICE', 'CLOSED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RECEPTION',
    "cubicle_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cubicles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "CubicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cubicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_sequences" (
    "sequence_name" TEXT NOT NULL,
    "next_value" BIGINT NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_sequences_pkey" PRIMARY KEY ("sequence_name")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "sequence_number" BIGINT NOT NULL,
    "public_code" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_document" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "cubicle_id" TEXT,
    "created_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3),
    "called_at" TIMESTAMP(3),
    "service_started_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "terminal_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_status_history" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "cubicle_id" TEXT,
    "actor_user_id" TEXT,
    "reason_code" TEXT,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_calls" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "cubicle_id" TEXT NOT NULL,
    "called_by" TEXT NOT NULL,
    "call_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_public_id" TEXT,
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_token_hash_idx" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "cubicles_code_key" ON "cubicles"("code");

-- CreateIndex
CREATE INDEX "cubicles_status_active_id_idx" ON "cubicles"("status", "active", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_public_id_key" ON "tickets"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_sequence_number_key" ON "tickets"("sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_public_code_key" ON "tickets"("public_code");

-- CreateIndex
CREATE INDEX "ix_tickets_queue" ON "tickets"("status", "created_at", "sequence_number", "id");

-- CreateIndex
CREATE INDEX "ix_tickets_cubicle_status" ON "tickets"("cubicle_id", "status");

-- CreateIndex
CREATE INDEX "ix_tickets_document_status" ON "tickets"("patient_document", "status");

-- CreateIndex
CREATE INDEX "ix_history_ticket_time" ON "ticket_status_history"("ticket_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ix_history_time" ON "ticket_status_history"("created_at", "id");

-- CreateIndex
CREATE INDEX "ix_calls_recent" ON "ticket_calls"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_calls_ticket_id_call_number_key" ON "ticket_calls"("ticket_id", "call_number");

-- CreateIndex
CREATE INDEX "ix_idempotency_expiry" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_actor_user_id_operation_idempotency_key_key" ON "idempotency_keys"("actor_user_id", "operation", "idempotency_key");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_cubicle_id_fkey" FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_cubicle_id_fkey" FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_calls" ADD CONSTRAINT "ticket_calls_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_calls" ADD CONSTRAINT "ticket_calls_cubicle_id_fkey" FOREIGN KEY ("cubicle_id") REFERENCES "cubicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_calls" ADD CONSTRAINT "ticket_calls_called_by_fkey" FOREIGN KEY ("called_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

