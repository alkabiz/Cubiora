-- ==============================================================================
-- CUBIORA PMV — INSERCIÓN DE USUARIOS (CAJERO Y RECEPTOR)
-- Archivo: docs/sql/insert-users.sql
-- Motor: PostgreSQL 18
--
-- Usuarios insertados:
--   1. Cajero:
--      - username: cajero
--      - role: CASHIER
--      - display_name: Atención Cubículo 01
--   2. Receptor:
--      - username: receptor
--      - role: RECEPTION
--      - display_name: Recepción de Farmacia
--
-- Seguridad:
--   - Contraseñas almacenadas exclusivamente con hash bcrypt (10 rounds).
--   - Identificadores generados con formato estándar ULID (26 caracteres).
--   - Idempotente: ON CONFLICT ("username") DO UPDATE para permitir reejecución segura.
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Insertar / Actualizar Usuario Cajero
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
  '$2b$10$PcCRgMtvN/VgYLJ1anQtJOh9yKmci7jNtXkjX.92dW.AE5I9x1U1C',
  'Atención Cubículo 01',
  'CASHIER'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO UPDATE SET
  "password_hash" = EXCLUDED."password_hash",
  "display_name"  = EXCLUDED."display_name",
  "role"          = EXCLUDED."role",
  "active"        = true,
  "updated_at"    = CURRENT_TIMESTAMP;

-- 2. Insertar / Actualizar Usuario Receptor
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
  '$2b$10$PcCRgMtvN/VgYLJ1anQtJONxgsPb88/e0Fy49z/mmkBeozDkol25K',
  'Recepción de Farmacia',
  'RECEPTION'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO UPDATE SET
  "password_hash" = EXCLUDED."password_hash",
  "display_name"  = EXCLUDED."display_name",
  "role"          = EXCLUDED."role",
  "active"        = true,
  "updated_at"    = CURRENT_TIMESTAMP;

-- 3. Inserción de compatibilidad con alias de desarrollo (recepcion y cajero1)
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
  '$2b$10$PcCRgMtvN/VgYLJ1anQtJOh9yKmci7jNtXkjX.92dW.AE5I9x1U1C',
  'Atención Cubículo 1',
  'CASHIER'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO UPDATE SET
  "password_hash" = EXCLUDED."password_hash",
  "display_name"  = EXCLUDED."display_name",
  "role"          = EXCLUDED."role",
  "active"        = true,
  "updated_at"    = CURRENT_TIMESTAMP;

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
  '$2b$10$PcCRgMtvN/VgYLJ1anQtJONxgsPb88/e0Fy49z/mmkBeozDkol25K',
  'Recepcionista Turnos',
  'RECEPTION'::"UserRole",
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO UPDATE SET
  "password_hash" = EXCLUDED."password_hash",
  "display_name"  = EXCLUDED."display_name",
  "role"          = EXCLUDED."role",
  "active"        = true,
  "updated_at"    = CURRENT_TIMESTAMP;

COMMIT;

-- Verificación de inserción
SELECT 
  "id", 
  "public_id", 
  "username", 
  "display_name", 
  "role", 
  "active", 
  "created_at"
FROM "users"
WHERE "username" IN ('cajero', 'receptor', 'cajero1', 'recepcion')
ORDER BY "role", "username";
