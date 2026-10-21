-- ==============================================================================
-- BORRADOR DE MIGRACIÓN: GRANT Y REVOKE EXPLÍCITOS (MATRIZ DBA PMV)
-- Archivo: docs/borrador-migracion-grants.sql
-- Estado: BORRADOR PARA REVISIÓN (NO APLICAR DIRECTAMENTE)
--
-- Matriz de Mínimo Privilegio:
-- - cubiora_app: Operación DML estricta
-- - cubiora_readonly: Auditoría y métricas con exclusión de PII y credenciales
-- ==============================================================================

-- 1. Permisos de Esquema
GRANT USAGE ON SCHEMA public TO cubiora_app;
GRANT USAGE ON SCHEMA public TO cubiora_readonly;

-- 2. Permisos para ROL DE APLICACIÓN: cubiora_app
-- A) Tablas operativas mutables: SELECT, INSERT, UPDATE
GRANT SELECT, INSERT, UPDATE ON
  "users",
  "cubicles",
  "tickets",
  "system_sequences",
  "idempotency_keys"
TO cubiora_app;

-- B) Tablas inmutables WORM: SELECT, INSERT (ESTRICTAMENTE SIN UPDATE NI DELETE)
GRANT SELECT, INSERT ON
  "ticket_status_history",
  "ticket_calls"
TO cubiora_app;

REVOKE UPDATE, DELETE ON
  "ticket_status_history",
  "ticket_calls"
FROM cubiora_app;

-- C) DELETE permitido ÚNICAMENTE en idempotency_keys para expiración de llaves
GRANT DELETE ON
  "idempotency_keys"
TO cubiora_app;

-- Revocación preventiva de DELETE en tablas principales
REVOKE DELETE ON
  "users",
  "cubicles",
  "tickets",
  "system_sequences"
FROM cubiora_app;

-- D) Secuencias
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cubiora_app;


-- 3. Permisos para ROL DE AUDITORÍA / LECTURA: cubiora_readonly
-- A) Tablas de lectura completa sin datos sensibles
GRANT SELECT ON
  "cubicles",
  "system_sequences",
  "ticket_status_history",
  "ticket_calls"
TO cubiora_readonly;

-- B) Tabla users: Exclusión estricta de password_hash a nivel de columnas
GRANT SELECT (
  id,
  public_id,
  username,
  display_name,
  role,
  cubicle_id,
  active,
  created_at,
  updated_at
) ON "users" TO cubiora_readonly;

-- C) Tabla tickets: Exclusión estricta de patient_document (PII) a nivel de columnas
GRANT SELECT (
  id,
  public_id,
  sequence_number,
  public_code,
  patient_name,
  status,
  cubicle_id,
  created_by,
  assigned_at,
  called_at,
  service_started_at,
  closed_at,
  terminal_reason,
  version,
  created_at,
  updated_at
) ON "tickets" TO cubiora_readonly;

-- D) Cero acceso a idempotency_keys
REVOKE ALL ON "idempotency_keys" FROM cubiora_readonly;

-- 4. Sin Default Privileges (Principio DBA: todo permiso futuro es explícito)
ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM cubiora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM cubiora_readonly;
