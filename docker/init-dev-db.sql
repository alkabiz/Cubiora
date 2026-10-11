-- ==============================================================================
-- SCRIPT DE INICIALIZACIÓN DE ROLES Y PERMISOS — DESARROLLO LOCAL
-- Base de datos: cubiora_dev
--
-- ⚠️ AVISO IMPORTANTE DE SEGURIDAD Y GOBERNANZA:
-- Este archivo es de uso EXCLUSIVO para desarrollo local en contenedores efímeros.
-- Los permisos, usuarios, contraseñas y políticas de acceso para entornos
-- de STAGING y PRODUCCIÓN son definidos, custodiados y aplicados
-- DIRECTAMENTE POR EL DBA (por ejemplo en el host LXC de base de datos).
-- NUNCA ejecutar este script directamente en entornos productivos.
-- ==============================================================================

-- 1. Crear rol migrador (DDL - esquema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_migrator') THEN
    CREATE ROLE cubiora_migrator WITH LOGIN PASSWORD 'cubiora_migrator_dev';
  END IF;
END
$$;

-- 2. Crear rol de aplicación (DML - tiempo de ejecución)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cubiora_app') THEN
    CREATE ROLE cubiora_app WITH LOGIN PASSWORD 'cubiora_app_dev';
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
  idempotency_keys,
  user_sessions
TO cubiora_app;

-- B) SELECT, INSERT (ESTRICTAMENTE SIN UPDATE NI DELETE) en tablas de auditoría/eventos
GRANT SELECT, INSERT ON
  ticket_status_history,
  ticket_calls
TO cubiora_app;

-- C) DELETE ÚNICAMENTE en tablas efímeras/temporales que admiten purga o revocación
GRANT DELETE ON
  idempotency_keys,
  user_sessions
TO cubiora_app;

-- D) Uso de secuencias para autoincrementables
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cubiora_app;

-- Permisos por defecto para futuras tablas y secuencias creadas por cubiora_migrator
ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cubiora_app;
