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

-- El migrador es dueño del esquema para ejecutar DDL; PUBLIC no puede crear objetos
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO cubiora_migrator;
ALTER SCHEMA public OWNER TO cubiora_migrator;

-- La aplicación solo tiene uso del esquema
GRANT USAGE ON SCHEMA public TO cubiora_app;

-- 4. Permisos de mínimo privilegio para cubiora_app (si las tablas ya existen tras migración):
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    -- A) Tablas mutables sin borrado físico operativo
    REVOKE ALL ON TABLE users, tickets, system_sequences FROM PUBLIC, cubiora_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE users, tickets, system_sequences TO cubiora_app;

    -- B) Tablas de configuración/ciclo de vida gestionado y llaves idempotentes
    IF to_regclass('public.facilities') IS NOT NULL
       AND to_regclass('public.pharmacists') IS NOT NULL THEN
      REVOKE ALL ON TABLE idempotency_keys, facilities, pharmacists, cubicles FROM PUBLIC, cubiora_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE idempotency_keys, facilities, pharmacists, cubicles TO cubiora_app;
    ELSE
      REVOKE ALL ON TABLE idempotency_keys, cubicles FROM PUBLIC, cubiora_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE idempotency_keys, cubicles TO cubiora_app;
    END IF;

    -- C) Tablas inmutables WORM (ESTRICTAMENTE SELECT e INSERT; sin UPDATE/DELETE/TRUNCATE)
    REVOKE ALL ON TABLE ticket_status_history, ticket_calls FROM PUBLIC, cubiora_app;
    GRANT SELECT, INSERT ON TABLE ticket_status_history, ticket_calls TO cubiora_app;

    IF to_regclass('public.dispensation_records') IS NOT NULL THEN
      REVOKE ALL ON TABLE dispensation_records FROM PUBLIC, cubiora_app;
      GRANT SELECT, INSERT ON TABLE dispensation_records TO cubiora_app;
    END IF;

    -- D) Tabla interna de migraciones aislada
    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
      REVOKE ALL ON TABLE _prisma_migrations FROM PUBLIC, cubiora_app;
    END IF;
  END IF;
END
$$;

-- E) Uso de secuencias para autoincrementables
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cubiora_app;

-- Prohibir concesiones amplias por defecto sobre tablas futuras (grants explícitos en migraciones)
ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, cubiora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cubiora_app;
