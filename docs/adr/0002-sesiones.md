# ADR 0002: Gestión de Sesiones mediante Cookie HttpOnly Firmada sin Tabla user_sessions

## Estado
Aprobado (Decisión D-01)

## Contexto
En el diseño original del PMV v1.0 existía la interrogante de si implementar una tabla relacional `user_sessions` para almacenar el estado de cada sesión activa en base de datos o utilizar un esquema sin estado basado en cookies seguras.

Considerando que:
1. Cubiora es un PMV enfocado en una operación presencial de farmacia hospitalaria con un número acotado de operadores concurrentes (recepción y cubículos).
2. La arquitectura debe priorizar la simplicidad operativa, la minimización de consultas a base de datos en cada petición y una menor superficie de ataque.
3. El esquema acordado de 7 tablas mínimas no incluye la tabla `user_sessions`.

## Decisión
Implementar la autenticación de operadores mediante **cookies HttpOnly firmadas criptográficamente** (`SameSite=Strict`, `Secure` en producción):
- La cookie contiene el identificador del usuario, rol y una versión de credenciales (`tokenVersion`).
- La validación se realiza contra la clave secreta `SESSION_SECRET` (mínimo 32 caracteres) configurada por entorno.
- La revocación global o individual de sesiones se gestiona incrementando el contador de versión en el registro del usuario (`tokenVersion` en la tabla `users`), invalidando inmediatamente cualquier cookie emitida previamente sin requerir operaciones de inserción, actualización o borrado por cada login/logout en una tabla separada de sesiones.
- No se crea ni se mantiene la tabla `user_sessions` en el esquema de base de datos durante la etapa de PMV.

## Consecuencias
- **Positivas**:
  - Cero overhead de I/O en base de datos para crear, mantener o purgar registros de sesiones efímeras.
  - Simplificación del esquema Prisma y mantenimiento de solo 7 tablas esenciales del dominio.
  - Cumplimiento de los estándares de seguridad web contra ataques XSS (cookies inaccesibles por JavaScript) y CSRF (`SameSite=Strict`).
  - Capacidad de revocación inmediata de sesiones ante cambios de contraseña o desactivación de cuentas.
- **Negativas / Mitigaciones**:
  - No permite listado granular de sesiones concurrentes por dispositivo (aceptable para el alcance de PMV presencial).
  - Si en versiones futuras se requiere trazabilidad de dispositivos o auditoría por sesión simultánea, se evaluará la introducción de un almacén dedicado (Redis o tabla de sesiones).
