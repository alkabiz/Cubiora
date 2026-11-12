-- ==============================================================================
-- CUBIORA PMV — PLANTILLA DE INSERCIÓN SEGURA DE USUARIOS DE DESARROLLO
-- Archivo: docs/sql/insert-users.sql
-- Motor: PostgreSQL 18
--
-- ⚠️ AVISO DE SEGURIDAD:
-- - NO almacene hashes estáticos ni contraseñas reales en este archivo.
-- - NO sobrescriba usuarios existentes ni reactive cuentas inactivas (usa DO NOTHING).
-- - Pase hashes bcrypt individuales generados en entorno local mediante psql -v:
--     psql -U cubiora_migrator -d cubiora_dev \
--       -v CAJERO_HASH='$2b$10$...' -v RECEPTOR_HASH='$2b$10$...' \
--       -v CAJERO1_HASH='$2b$10$...' -v RECEPCION_HASH='$2b$10$...' \
--       -f docs/sql/insert-users.sql
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Insertar Usuario Cajero (idempotente sin sobrescribir perfiles/contraseñas)
INSERT INTO "users" (
  "id",
  "public_id",
  "username",
  "password_hash",
  "display_name",
  "role",
  "cubicle_id",
  "active",
  "created_at",
  "updated_at"
) VALUES (
  '01M5ETE5D0ERHX2HHR5M6ZKD7M',
  '01M5ETE5D0YVSW9HFH0SJKYMW9',
  'cajero',
  :'CAJERO_HASH',
  'Atención Cubículo 01',
  'CASHIER'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;

-- 2. Insertar Usuario Receptor (sin sobrescribir existentes)
INSERT INTO "users" (
  "id",
  "public_id",
  "username",
  "password_hash",
  "display_name",
  "role",
  "cubicle_id",
  "active",
  "created_at",
  "updated_at"
) VALUES (
  '01M5ETE5ESN3M9XBER5R9QT2KY',
  '01M5ETE5ESMYYVTK42BYPCWR26',
  'receptor',
  :'RECEPTOR_HASH',
  'Recepción de Farmacia',
  'RECEPTION'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;

-- 3. Alias de desarrollo (recepcion y cajero1)
INSERT INTO "users" (
  "id",
  "public_id",
  "username",
  "password_hash",
  "display_name",
  "role",
  "cubicle_id",
  "active",
  "created_at",
  "updated_at"
) VALUES (
  '01M5ETE5D1A1B2C3D4E5F6G7H8',
  '01M5ETE5D1X9Y8Z7W6V5U4T3S2',
  'cajero1',
  :'CAJERO1_HASH',
  'Atención Cubículo 1',
  'CASHIER'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;

INSERT INTO "users" (
  "id",
  "public_id",
  "username",
  "password_hash",
  "display_name",
  "role",
  "cubicle_id",
  "active",
  "created_at",
  "updated_at"
) VALUES (
  '01M5ETE5ESJ1K2L3M4N5P6Q7R8',
  '01M5ETE5ESH8G7F6E5D4C3B2A1',
  'recepcion',
  :'RECEPCION_HASH',
  'Recepcionista Turnos',
  'RECEPTION'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;

-- 4. Asignación determinista únicamente si el operador aún no tiene cubículo asignado
--    y el cubículo no está ocupado por otro usuario (restricción UNIQUE users.cubicle_id).
UPDATE "users" AS u
SET "cubicle_id" = c."id", "updated_at" = CURRENT_TIMESTAMP
FROM "cubicles" AS c
WHERE u."username" = 'cajero'
  AND c."code" = 'CUB-03'
  AND u."cubicle_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "users" u2 WHERE u2."cubicle_id" = c."id");

UPDATE "users" AS u
SET "cubicle_id" = c."id", "updated_at" = CURRENT_TIMESTAMP
FROM "cubicles" AS c
WHERE u."username" = 'cajero1'
  AND c."code" = 'CUB-01'
  AND u."cubicle_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "users" u2 WHERE u2."cubicle_id" = c."id");

COMMIT;

-- Verificación de inserción
SELECT 
  "id", 
  "public_id", 
  "username", 
  "display_name", 
  "role", 
  "cubicle_id",
  "active", 
  "created_at"
FROM "users"
WHERE "username" IN ('cajero', 'receptor', 'cajero1', 'recepcion')
ORDER BY "role", "username";
