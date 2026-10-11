# SQL Fuera del Alcance de Prisma — Cubiora

Este directorio contiene sentencias DDL y objetos de base de datos PostgreSQL que no son modelables de forma nativa a través de `schema.prisma` y deben ser aplicados por el DBA o mediante migraciones SQL directas (`prisma migrate dev --create-only`).

---

## 1. Índice Parcial Único: Un Solo Ticket Activo por Cubículo

Garantiza a nivel de base de datos que un cubículo nunca pueda tener más de un ticket en estado `ATTENDING` simultáneamente, evitando condiciones de carrera en la asignación:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_ticket_per_cubicle
ON tickets (cubicle_id)
WHERE status = 'ATTENDING' AND cubicle_id IS NOT NULL;
```

---

## 2. Trigger de Inmutabilidad en Auditoría (`ticket_audits`)

La tabla `ticket_audits` es un registro de auditoría estricto. Ninguna fila debe poder ser modificada ni eliminada por ningún usuario de aplicación:

```sql
CREATE OR REPLACE FUNCTION trg_prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Las entradas de auditoría en ticket_audits son inmutables y no se pueden modificar ni eliminar.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_immutable ON ticket_audits;
CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON ticket_audits
FOR EACH ROW EXECUTE FUNCTION trg_prevent_audit_modification();
```

---

## 3. Función y Triggers para `updated_at` Automático

Garantiza que la marca de tiempo `updated_at` se actualice de forma consistente ante cualquier `UPDATE`:

```sql
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_cubicles_updated_at ON cubicles;
CREATE TRIGGER trg_cubicles_updated_at
BEFORE UPDATE ON cubicles
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
```

---

## 4. Permisos de Mínimo Privilegio (Coordinación con DBA Proxmox LXC 192.168.1.33)

- **`cubiora_app`** (Runtime):
  - `GRANT USAGE ON SCHEMA public TO cubiora_app;`
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cubiora_app;`
  - Excepción para `user_sessions`: permiso `DELETE` restringido a sesiones expiradas (`expires_at < NOW()`).
  - `REVOKE UPDATE, DELETE ON TABLE ticket_audits FROM cubiora_app;`
- **`cubiora_migrator`** (Migraciones / DDL):
  - `GRANT ALL PRIVILEGES ON SCHEMA public TO cubiora_migrator;`
  - `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cubiora_migrator;`
