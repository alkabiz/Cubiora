-- ==============================================================================
-- CUBIORA PMV — CONFIGURACIÓN LOCAL DE BASE DE DATOS (PostgreSQL 18)
-- Archivo: docs/dev-db-setup.sql
--
-- Uso:
--   psql -U postgres -h localhost -v MIGRATOR_PASSWORD='...' -v APP_PASSWORD='...' -f docs/dev-db-setup.sql
--
-- ⚠️ NUNCA almacenar contraseñas en este archivo.
-- ==============================================================================

\set ON_ERROR_STOP on

-- 1. Crear base de datos de desarrollo si no existe
SELECT 'CREATE DATABASE cubiora_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cubiora_dev')\gexec

-- 2. Crear rol cubiora_migrator (con permisos DDL para Prisma CLI)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_migrator') THEN
    EXECUTE format('CREATE ROLE cubiora_migrator WITH LOGIN PASSWORD %L', :'MIGRATOR_PASSWORD');
    RAISE NOTICE 'Rol cubiora_migrator creado exitosamente.';
  ELSE
    EXECUTE format('ALTER ROLE cubiora_migrator WITH PASSWORD %L', :'MIGRATOR_PASSWORD');
    RAISE NOTICE 'Contraseña de cubiora_migrator actualizada.';
  END IF;
END
$$;

-- 3. Crear rol cubiora_app (mínimo privilegio para runtime de NestJS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_app') THEN
    EXECUTE format('CREATE ROLE cubiora_app WITH LOGIN PASSWORD %L', :'APP_PASSWORD');
    RAISE NOTICE 'Rol cubiora_app creado exitosamente.';
  ELSE
    EXECUTE format('ALTER ROLE cubiora_app WITH PASSWORD %L', :'APP_PASSWORD');
    RAISE NOTICE 'Contraseña de cubiora_app actualizada.';
  END IF;
END
$$;

-- 4. Asignar propiedad y permisos sobre la base de datos
GRANT ALL PRIVILEGES ON DATABASE cubiora_dev TO cubiora_migrator;
GRANT CONNECT ON DATABASE cubiora_dev TO cubiora_app;

-- 5. Conectar a cubiora_dev para configurar el esquema public
\connect cubiora_dev

GRANT ALL ON SCHEMA public TO cubiora_migrator;
ALTER SCHEMA public OWNER TO cubiora_migrator;

GRANT USAGE ON SCHEMA public TO cubiora_app;

-- Permisos por defecto para que las tablas y secuencias creadas por el migrador
-- puedan ser consultadas y operadas por la aplicacion
ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cubiora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cubiora_app;

RAISE NOTICE '✅ Base cubiora_dev y roles cubiora_migrator / cubiora_app configurados correctamente.';
