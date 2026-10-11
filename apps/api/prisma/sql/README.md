# Gestión de Migraciones y Objetos Avanzados de Base de Datos

## 1. Naturaleza de las Migraciones en Prisma
Las migraciones generadas por Prisma (`prisma/migrations/**/migration.sql`) **NO SON SCRIPTS IDEMPOTENTES**:
- Son transiciones incrementales de estado DDL registradas en la tabla de control `_prisma_migrations`.
- Ejecutar el SQL de una migración directamente contra una base de datos sin registrarla en `_prisma_migrations` generará conflictos de deriva de esquema (*schema drift*).

---

## 2. Procedimiento de Aplicación
En entornos controlados (Staging, Producción):
1. **Usuario Requerido:** Únicamente el usuario con privilegios DDL `cubiora_migrator`. El usuario de aplicación (`cubiora_app`) carece de permisos para alterar el esquema.
2. **Variable de Entorno:** Se debe proveer `DIRECT_URL` apuntando a la conexión directa con `cubiora_migrator`.
3. **Comando Oficial:**
   ```bash
   pnpm --filter api exec prisma migrate deploy
   ```
4. **Verificación:** Consultar la tabla `_prisma_migrations` para confirmar que el registro finaliza con `finished_at IS NOT NULL` y `rolled_back_at IS NULL`.

---

## 3. Migraciones Manuales Pendientes (Sin Aplicar)
El archivo [`prisma/manual_migrations/20261011000001_manual_triggers_and_indexes.sql`](file:///c:/Users/Juan%20Jos%C3%A9%20Henao%20G/Desktop/Cubiora/apps/api/prisma/manual_migrations/20261011000001_manual_triggers_and_indexes.sql) contiene objetos fuera de la capacidad declarativa de `schema.prisma`:
1. **Índice Parcial Único:** `uq_active_ticket_per_cubicle` en `tickets (cubicle_id)` para estados `ASSIGNED, CALLED, IN_SERVICE`.
2. **Triggers de Inmutabilidad:** Triggers PL/pgSQL que impiden `UPDATE` o `DELETE` sobre `ticket_status_history` y `ticket_calls`.
3. **Triggers de `updated_at`:** Para actualización garantizada a nivel de motor en `users`, `cubicles`, `tickets` y `system_sequences`.

> **ESTADO:** Este script se mantiene deliberadamente **sin aplicar** en el pipeline automático de Prisma, a la espera de revisión y ejecución directa por parte del DBA del entorno destino.
