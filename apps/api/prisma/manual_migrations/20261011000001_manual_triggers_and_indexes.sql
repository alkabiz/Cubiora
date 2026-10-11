-- ==============================================================================
-- MIGRACIÓN MANUAL (NO APLICADA AUTOMÁTICAMENTE POR PRISMA)
-- Archivo: 20261011000001_manual_triggers_and_indexes.sql
--
-- Propósito:
-- Contiene objetos DDL de PostgreSQL avanzados (índices parciales, triggers de
-- inmutabilidad y funciones de actualización) que Prisma no soporta en schema.prisma.
--
-- APLICACIÓN:
-- Debe ser revisada por el DBA y aplicada ÚNICAMENTE con el usuario `cubiora_migrator`
-- tras verificar la migración base generada por `prisma migrate deploy`.
-- ==============================================================================

-- 1. ÍNDICE PARCIAL ÚNICO: Prevenir que un cubículo atienda simultáneamente múltiples turnos
-- Solo puede existir un turno en estados activos (ASSIGNED, CALLED, IN_SERVICE) por cubículo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_ticket_per_cubicle
ON tickets (cubicle_id)
WHERE status IN ('ASSIGNED', 'CALLED', 'IN_SERVICE') AND cubicle_id IS NOT NULL;

-- 2. TRIGGER DE INMUTABILIDAD EN HISTORIAL DE ESTADOS (ticket_status_history)
CREATE OR REPLACE FUNCTION trg_prevent_history_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Las transiciones de estado en ticket_status_history son inmutables (WORM). Operación prohibida.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_history_immutable ON ticket_status_history;
CREATE TRIGGER trg_history_immutable
BEFORE UPDATE OR DELETE ON ticket_status_history
FOR EACH ROW EXECUTE FUNCTION trg_prevent_history_tampering();

-- 3. TRIGGER DE INMUTABILIDAD EN REGISTRO DE LLAMADOS (ticket_calls)
CREATE OR REPLACE FUNCTION trg_prevent_calls_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'El registro histórico de llamados en ticket_calls es inmutable. Operación prohibida.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calls_immutable ON ticket_calls;
CREATE TRIGGER trg_calls_immutable
BEFORE UPDATE OR DELETE ON ticket_calls
FOR EACH ROW EXECUTE FUNCTION trg_prevent_calls_tampering();

-- 4. FUNCIÓN Y TRIGGERS PARA UPDATED_AT AUTOMÁTICO A NIVEL DE MOTOR
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_cubicles_updated_at ON cubicles;
CREATE TRIGGER trg_cubicles_updated_at
BEFORE UPDATE ON cubicles
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_system_sequences_updated_at ON system_sequences;
CREATE TRIGGER trg_system_sequences_updated_at
BEFORE UPDATE ON system_sequences
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
