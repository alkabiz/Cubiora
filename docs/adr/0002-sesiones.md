# ADR 0002: Gestión de Autenticación Mediante Sesiones de Servidor y Tabla `user_sessions`

## Estado
Aprobado (Esqueleto inicial en schema, implementación de lógica pendiente)

## Contexto
El Documento Técnico PMV v1.0 no detallaba el mecanismo específico de persistencia de sesión ni contemplaba la tabla correspondiente en el diagrama inicial. Para prevenir vulnerabilidades XSS asociadas al almacenamiento de JWTs en LocalStorage, se acordó utilizar cookies HTTP-only, `Secure` y `SameSite` respaldadas por una sesión de servidor.

Se descartó el uso de `connect-pg-simple` para mantener control absoluto sobre el esquema, tipado e índices en Prisma.

## Decisión
1. Incorporar la tabla propia `user_sessions` en el esquema de Prisma con los campos:
   - `id`: Identificador único (UUID).
   - `user_id`: Referencia foránea a la tabla `users`.
   - `token_hash`: Hash criptográfico del token de sesión (único e indexado).
   - `expires_at`: Timestamp de expiración.
   - `revoked_at`: Timestamp de revocación manual (cierre de sesión explícito).
   - `created_at`: Fecha y hora de creación.
   - `ip_address`: Dirección IP minimizada.
   - `user_agent`: Cabecera User-Agent truncada/minimizada.

2. **Coordinación requerida con el DBA** (Proxmox LXC 192.168.1.33):
   - Esta tabla **no estaba presente en el documento técnico v1.0 original**.
   - El DBA debe otorgar los siguientes permisos específicos para el usuario `cubiora_app`:
     - `SELECT`, `INSERT`, `UPDATE` sobre `user_sessions`.
     - Permiso `DELETE` restringido exclusivamente a limpieza de sesiones expiradas (`expires_at < NOW()`) o manejado mediante job de mantenimiento periódico.

## Consecuencias
- Cero exposición de credenciales o tokens a scripts cliente (protección total contra robo de sesión por XSS).
- Capacidad de revocación instantánea de sesiones en caso de sospecha de compromiso.
- Requiere mantenimiento periódico de purga de sesiones expiradas.
