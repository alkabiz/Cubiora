# ADR 0001: Adopción de PostgreSQL 18.6 en Reemplazo de MySQL 8.4

## Estado
Aprobado

## Contexto
El Documento Técnico PMV v1.0 original mencionaba MySQL 8.4 como motor de base de datos. Sin embargo, para la infraestructura y el entorno de base de datos se ha estandarizado PostgreSQL 18.6.

Adicionalmente, los requerimientos del dominio (índices parciales condicionales, triggers de inmutabilidad estricta para auditoría WORM, y soporte avanzado de tipos JSONB para metadatos) se implementan con mayor robustez y estándar en PostgreSQL 18.6.

## Decisión
Utilizar PostgreSQL 18.6 como motor de base de datos relacional para todo el ciclo de vida del proyecto (desarrollo local en Windows nativo y servicios de CI, y servidor dedicado en producción), configurando Prisma ORM con el driver adapter `@prisma/adapter-pg`.

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
