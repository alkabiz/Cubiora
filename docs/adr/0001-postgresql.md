# ADR 0001: Adopción Propuesta de PostgreSQL 18.6 para Cubiora

## 1. Estado
**Proposed** (Propuesto para revisión formal de Dirección Técnica; no se asume aprobación definitiva ni equivalencia aprobada automática).

## 2. Fecha
2026-10-21

## 3. Decisor
Equipo de Arquitectura e Infraestructura Cubiora (propuesto a Dirección Técnica y Oficial de Seguridad de la Información).

## 4. Contexto
El Documento Técnico PMV v1.0 original mencionaba MySQL 8.4 como motor de base de datos relacional. Durante la fase de diseño e implementación del modelo transaccional y de concurrencia, surgieron requerimientos críticos del dominio farmacéutico hospitalario:
- Prevención de doble atención simultánea en cubículos concurrentes mediante índices condicionales parciales.
- Trazabilidad append-only para auditoría con tipado estructurado `JSONB` de payloads y metadatos.
- Modelo de mínimo privilegio granular con separación estricta de roles DML vs DDL.
- Arquitectura de serialización y secuencias estrictamente monotónicas (`FOR UPDATE`) sin huecos para turnos de pacientes.

## 5. Razón para Abandonar MySQL
1. **Falta de Índices Únicos Parciales en MySQL**: MySQL 8.4 no soporta nativamente cláusulas `WHERE` en índices únicos (`CREATE UNIQUE INDEX ... WHERE status = 'ATTENDING'`). Para emularlos, se requiere recurrir a columnas generadas virtuales con expresiones nulas o triggers de tabla, lo que introduce fragilidad y sobrecarga en el motor.
2. **Historial Append-Only a Nivel de Motor**: PostgreSQL permite revocar a nivel de tabla los comandos `UPDATE` y `DELETE` para el rol de aplicación (`cubiora_app`), permitiendo exclusivamente `INSERT` y `SELECT` sobre `ticket_status_history`. En MySQL, los privilegios a nivel de tabla aplican sobre todo el esquema o requieren vistas complejas sin el mismo nivel de garantía determinista.
3. **Manejo de Metadatos JSONB e Idempotencia**: El tipo `JSONB` de PostgreSQL almacena estructuras binarias indexables con operadores de contención `@>` y extracción optimizada, ideal para payloads de idempotencia y trazabilidad de eventos.
4. **Infraestructura Dedicada Existente**: La infraestructura de servidores dedicados de la organización cuenta con instancias PostgreSQL 18.6 optimizadas y con soporte nativo para TLS mutuo/CA interna.

## 6. Alternativas Consideradas
- **MySQL 8.4 (LTS)**:
  - *Ventajas*: Mención inicial en especificación preliminar.
  - *Desventajas*: Sin índices parciales condicionales; emulación compleja de append-only; mayor latencia en tipos JSON no binarios; mayor complejidad en secuencias sin huecos con aislamiento READ COMMITTED.
- **MariaDB 11.4**:
  - *Ventajas*: Compatibilidad con sintaxis MySQL y algunas extensiones analíticas.
  - *Desventajas*: No estandarizado en la infraestructura hospitalaria de la institución; carece de soporte oficial de primer nivel en Prisma 7 con driver adapters de alto rendimiento.
- **PostgreSQL 18.6**:
  - *Ventajas*: Soporte completo de índices condicionales parciales; roles granulares DML/DDL nativos; `JSONB`; arquitectura de transacciones ACID comprobada; compatibilidad nativa con `@prisma/adapter-pg`.
  - *Desventajas*: Requiere validación de certificados TLS estrictos y gobernanza de conexiones (mitigado con pool dedicado en `pg`).

## 7. Decisión
Se propone formalmente utilizar **PostgreSQL 18.6** como motor de base de datos relacional del sistema Cubiora, operando a través de Prisma ORM 7 con el driver adapter `@prisma/adapter-pg`.

La arquitectura de datos se estructura en:
- `cubiora_app`: Rol de runtime para la API NestJS, con privilegios estrictos DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) en el esquema `public`, y permiso restringido exclusivamente a `SELECT` e `INSERT` en `ticket_status_history` (prohibido `UPDATE` y `DELETE`). Sin privilegios de DDL ni de administración de roles.
- `cubiora_migrator`: Rol exclusivo para ejecución de migraciones de esquema en CI/CD y despliegues controlados, no utilizado por la API en runtime.

## 8. Estrategia de Backup
- **Backup Lógico Diario**: Ejecución programada de `pg_dump` con formato custom comprimido (`-Fc`) diario a las 02:00 AM UTC, incluyendo checksums SHA-256 de integridad.
- **Retención de Backups**: Retención de 30 días locales y 90 días en almacenamiento inmutable secundario (WORM / Object Storage con Object Lock).

## 9. Estrategia de Restore
- **Procedimiento de Restauración**: Ejecución mediante `pg_restore` con flags de validación (`--clean --if-exists --single-transaction --exit-on-error`).
- **Simulacro Periódico**: Prueba mensual de restauración automatizada en un entorno de staging aislado para verificar la integridad de la base y tiempos de RTO (Recovery Time Objective < 15 minutos).

## 10. Estrategia PITR (Point-in-Time Recovery)
- **WAL Archiving Continuo**: Activación de `archive_mode = on` con `archive_command` transmitiendo segmentos de WAL (Write-Ahead Logging) cada 60 segundos hacia almacenamiento externo redundante.
- **Ventana de Recuperación**: Capacidad de restaurar la base de datos a cualquier segundo dentro de los últimos 14 días (RPO < 1 minuto).

## 11. Seguridad TLS
- **Verificación Estricta**: Toda conexión a PostgreSQL (desarrollo con servidor LAN, staging y producción) debe utilizar TLS con certificado verificado contra la CA interna de la organización.
- **Parámetros**: `rejectUnauthorized: true`, `sslmode=verify-full` (o `verify-ca` según topología de red).
- **Fail-Fast en Arranque**: Si `NODE_ENV=production` y la conexión no valida el certificado CA o detecta `NODE_TLS_REJECT_UNAUTHORIZED=0`, la API aborta inmediatamente su inicio.

## 12. Operación y Mantenimiento
- **Pool de Conexiones**: Límite de 10 conexiones simultáneas por réplica de API, con `idleTimeoutMillis = 30000` y `connectionTimeoutMillis = 5000`.
- **Monitoreo de Bloqueos y Concurrencia**: Alarmas configuradas en pg_stat_activity para consultas con duración > 2000 ms.
- **Vacuuming y Análisis**: Autovacuum habilitado con afinación agresiva (`autovacuum_vacuum_scale_factor = 0.05`, `autovacuum_analyze_scale_factor = 0.02`) para evitar bloat en tablas de alta rotación (`tickets`, `ticket_status_history`, `idempotency_keys`).

## 13. Consecuencias
- **Positivas**:
  - Eliminación de condiciones de carrera mediante índices únicos condicionales y secuencias FOR UPDATE.
  - Cumplimiento de estándares de auditoría médica hospitalaria con historial append-only real.
  - Cero dependencias de extensiones externas no mantenidas.
- **Negativas / Riesgos Identificados**:
  - La migración desde especificaciones que contemplaban MySQL exige actualizar toda la documentación técnica, diagramas y scripts de despliegue.
  - La adopción queda sujeta a la aprobación final de Dirección Técnica (marcada como `Proposed`).
