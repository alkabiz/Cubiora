-- ==============================================================================
-- CUBIORA: VERIFICACIÓN DE POST-DESPLIEGUE Y HARDENING (FASE 4)
-- Archivo: docs/sql/verify-phase4-postdeploy.sql
-- Solo lectura: ejecutar en PostgreSQL tras aplicar `prisma migrate deploy`.
-- ==============================================================================

-- 1. Estado de TLS en la sesión actual
SELECT
  current_user AS active_role,
  ssl,
  version AS tls_version,
  cipher,
  bits
FROM pg_stat_ssl
WHERE pid = pg_backend_pid();

-- 2. Migraciones Prisma aplicadas (verificar 20261111180000_security_hardening_phase4)
SELECT
  migration_name,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 10;

-- 3. Columna token_version, constraint y índice único parcial de farmacéutico-cubículo
SELECT
  c.column_name,
  c.data_type,
  c.column_default,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'users'
  AND c.column_name = 'token_version';

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'chk_users_token_version_non_negative';

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'uq_pharmacists_cubicle_assigned';

-- 4. Triggers WORM en tablas históricas y de dispensación
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event_type,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('ticket_status_history', 'ticket_calls', 'dispensation_records')
ORDER BY event_object_table, trigger_name, event_manipulation;

-- 5. Matriz efectiva de privilegios para cubiora_app (sin DELETE en tablas WORM/núcleo, sin acceso a _prisma_migrations)
SELECT
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'cubiora_app'
  AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- 6. Verificar que PUBLIC no tenga CREATE en schema public
SELECT
  nspname AS schema_name,
  has_schema_privilege('PUBLIC', nspname, 'CREATE') AS public_can_create,
  has_schema_privilege('cubiora_app', nspname, 'USAGE') AS app_has_usage,
  has_schema_privilege('cubiora_app', nspname, 'CREATE') AS app_can_create
FROM pg_namespace
WHERE nspname = 'public';

