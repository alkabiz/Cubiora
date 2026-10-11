# ADR 0001: Adopción de PostgreSQL 16+ en Reemplazo de MySQL 8.4

## Estado
Aprobado

## Contexto
El Documento Técnico PMV v1.0 original mencionaba MySQL 8.4 como motor de base de datos. Sin embargo, para la infraestructura de producción se ha provisto una instancia en Proxmox LXC (192.168.1.33:5432) configurada con PostgreSQL 16+.

Adicionalmente, los requerimientos del dominio (índices parciales condicionales, triggers de inmutabilidad estricta para auditoría, y soporte avanzado de tipos JSONB para metadatos) se implementan con mayor robustez y estándar en PostgreSQL.

## Decisión
Utilizar PostgreSQL 16+ como motor de base de datos relacional para todo el ciclo de vida del proyecto (desarrollo local y producción), configurando Prisma ORM con el driver adapter `@prisma/adapter-pg`.

Se implementa una separación estricta de usuarios:
- `cubiora_app`: Usuario de runtime sin privilegios de DDL.
- `cubiora_migrator`: Usuario exclusivo para ejecución de migraciones Prisma.
- `cubiora_readonly`: Usuario para analítica o auditoría externa.

## Consecuencias
- **Positivas**:
  - Índices únicos parciales (`WHERE status = 'ATTENDING'`) soportados nativamente para prevenir dobles atenciones.
  - Mayor seguridad con triggers de inmutabilidad en PostgreSQL.
  - Compatibilidad total con la infraestructura existente en Proxmox.
- **Negativas / Mitigaciones**:
  - Requiere asegurar compatibilidad de extensiones y drivers en Node.js (mitigado con `pg` y `@prisma/adapter-pg`).
