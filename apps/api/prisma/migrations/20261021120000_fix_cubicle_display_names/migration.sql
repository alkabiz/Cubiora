-- ==============================================================================
-- Migración: 20261021120000_fix_cubicle_display_names
-- Propósito: Estandarizar display_name de cubículos según especificación oficial
-- Riesgo: ALTO (Operación DDL/DML controlada sobre tabla maestra de cubículos)
-- Precondición: No alterar códigos internos (code) ni identificadores (id).
-- ==============================================================================

-- 1. Verificación previa de existencia
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cubicles') THEN
    RAISE EXCEPTION 'Tabla cubicles no encontrada. Migración abortada.';
  END IF;
END $$;

-- 2. Actualización determinista de display_name
UPDATE "cubicles"
SET "display_name" = 'Cubículo 01'
WHERE "code" = 'CUB-01';

UPDATE "cubicles"
SET "display_name" = 'Cubículo 02'
WHERE "code" = 'CUB-02';

UPDATE "cubicles"
SET "display_name" = 'Cubículo 03'
WHERE "code" = 'CUB-03';
