-- Script de inicialización de roles y base de datos para desarrollo local
-- Base de datos: cubiora_dev

-- 1. Crear rol migrador (DDL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_migrator') THEN
    CREATE ROLE cubiora_migrator WITH LOGIN PASSWORD 'cubiora_migrator_dev';
  END IF;
END
$$;

-- 2. Crear rol de aplicación (DML runtime)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_app') THEN
    CREATE ROLE cubiora_app WITH LOGIN PASSWORD 'cubiora_app_dev';
  END IF;
END
$$;

-- 3. Otorgar permisos sobre la base de datos
GRANT ALL PRIVILEGES ON DATABASE cubiora_dev TO cubiora_migrator;

\connect cubiora_dev

GRANT ALL ON SCHEMA public TO cubiora_migrator;
GRANT USAGE ON SCHEMA public TO cubiora_app;

-- Permisos por defecto para futuras tablas creadas por cubiora_migrator
ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cubiora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cubiora_app;
