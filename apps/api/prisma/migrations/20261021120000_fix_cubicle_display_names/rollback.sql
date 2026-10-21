-- ==============================================================================
-- Rollback: 20261021120000_fix_cubicle_display_names
-- Propósito: Revertir display_name de cubículos a valores anteriores de módulo
-- ==============================================================================

UPDATE "cubicles"
SET "display_name" = 'Modulo 1 - Farmacia'
WHERE "code" = 'CUB-01';

UPDATE "cubicles"
SET "display_name" = 'Modulo 2 - Farmacia'
WHERE "code" = 'CUB-02';

UPDATE "cubicles"
SET "display_name" = 'Modulo 3 - Prioritario'
WHERE "code" = 'CUB-03';
