-- ==============================================================================
-- SCRIPT DE INICIALIZACIÓN DE ROLES Y PERMISOS — DESARROLLO LOCAL
-- Base de datos: cubiora_dev (PostgreSQL 18)
--
-- ⚠️ AVISO DE SEGURIDAD:
-- Este script no contiene contraseñas en texto claro.
-- Requiere ser ejecutado pasando variables mediante psql -v:
--   psql -U postgres -v MIGRATOR_PASSWORD='...' -v APP_PASSWORD='...' -f init-dev-db.sql
-- ==============================================================================

\set ON_ERROR_STOP on

-- 1. Crear rol migrador (DDL - esquema) parametrizado
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_migrator') THEN
    EXECUTE format('CREATE ROLE cubiora_migrator WITH LOGIN PASSWORD %L', :'MIGRATOR_PASSWORD');
  END IF;
END
$$;

-- 2. Crear rol de aplicación (DML - tiempo de ejecución) parametrizado
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_app') THEN
    EXECUTE format('CREATE ROLE cubiora_app WITH LOGIN PASSWORD %L', :'APP_PASSWORD');
  END IF;
END
$$;

-- 3. Permisos sobre la base de datos
GRANT ALL PRIVILEGES ON DATABASE cubiora_dev TO cubiora_migrator;

\connect cubiora_dev

-- El migrador es dueño del esquema para ejecutar DDL
GRANT ALL ON SCHEMA public TO cubiora_migrator;
ALTER SCHEMA public OWNER TO cubiora_migrator;

-- La aplicación solo tiene uso del esquema
GRANT USAGE ON SCHEMA public TO cubiora_app;

-- 4. Permisos de mínimo privilegio para cubiora_app:
-- A) SELECT, INSERT, UPDATE en tablas mutables operativas
GRANT SELECT, INSERT, UPDATE ON
  users,
  cubicles,
  tickets,
  system_sequences,
  idempotency_keys
TO cubiora_app;

-- B) SELECT, INSERT (ESTRICTAMENTE SIN UPDATE NI DELETE) en tablas inmutables WORM
GRANT SELECT, INSERT ON
  ticket_status_history,
  ticket_calls
TO cubiora_app;

-- C) DELETE ÚNICAMENTE en tabla de idempotencia (admite expiración)
GRANT DELETE ON
  idempotency_keys
TO cubiora_app;

-- D) Uso de secuencias para autoincrementables
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cubiora_app;

-- Permisos por defecto para futuras secuencias creadas por cubiora_migrator
ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cubiora_app;
