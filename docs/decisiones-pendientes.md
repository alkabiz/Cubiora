# Decisiones Pendientes de Aprobación y Validación — Cubiora

Este documento consolida los aspectos arquitectónicos, de negocio e infraestructura que han quedado deliberadamente acotados para el PMV y que requieren revisión o definición antes del despliegue productivo final.

---

## 1. Política de Retención y Purgado de Historial (Q4)
- **Estado en PMV**: Sin borrado automático. Todo el historial de turnos (`tickets`), transiciones (`ticket_status_history`), llamados (`ticket_calls`) e idempotencia se conserva permanentemente en base de datos.
- **Acción requerida**:
  - Definir la política de retención en coordinación con el área legal y cumplimiento normativo de historias/atención en salud.
  - Diseñar el mecanismo de archivado (particionamiento por mes/año o migración a almacenamiento frío) para evitar degradación de consultas históricas tras meses de operación intensa.

---

## 2. Tratamiento y Cifrado de Documento del Paciente (`patient_document`) (Q5)
- **Estado en PMV**: Almacenado en texto plano en la base de datos (protegido únicamente por el cifrado de volumen a nivel de servidor). Garantizado que nunca se expone en la pantalla pública (`/pantalla`) ni en logs estructurados.
- **Acción requerida**:
  - Realizar revisión jurídica de protección de datos personales (Habeas Data) con el área correspondiente.
  - Evaluar si se requiere cifrado a nivel de aplicación (ej. AES-GCM-256 con claves en gestor de secretos) o si basta con el cifrado de disco y control de acceso RBAC.

---

## 3. Política Operativa de Turnos No Presentados (`NO_SHOW_MAX_CALLS`) (Q3)
- **Estado en PMV**: Configurado provisionalmente en un máximo de **3 llamados** mediante la variable de entorno `NO_SHOW_MAX_CALLS=3`.
- **Acción requerida**:
  - Validar empíricamente con el equipo de operaciones de farmacia si 3 llamados representan el balance óptimo entre agilidad de la fila y tiempo de desplazamiento de usuarios con movilidad reducida.

---

## 4. Cantidad y Configuración Dinámica de Cubículos (Q1)
- **Estado en PMV**: Seed inicial configurado con **3 cubículos activos** (`CUB-01`, `CUB-02`, `CUB-03`) para desarrollo local.
- **Acción requerida**:
  - Validar la cantidad real de cubículos disponibles en la sede piloto física para ajustar el seed o interfaz administrativa de cubículos.

---

## 5. Construcción de Imágenes Docker (Dockerfile.api, Dockerfile.web)
- **Estado**: **[NO VERIFICADO]**
- **Causa**:
  - El entorno Windows local donde se ejecuta el desarrollo no cuenta con Docker CLI ni Docker Desktop instalado (`Get-Command docker: CommandNotFoundException`).
  - No hay distribuciones de Linux en WSL (`wsl -l -v: no tiene distribuciones instaladas`).
- **Acción requerida**:
  - Una vez instalado Docker Desktop o en el runner de GitHub Actions con motor Docker, ejecutar:
    ```bash
    docker build -t cubiora-api -f docker/Dockerfile.api .
    docker build -t cubiora-web -f docker/Dockerfile.web .
    ```

---

## 6. Ejecución de Migración contra PostgreSQL Real
- **Estado**: **[NO VERIFICADO EN MOTOR ACTIVO / ENTORNO REMOTO INTACTO]**
- **Causa**:
  - No existe un servidor PostgreSQL local activo en el puerto 5432 ni Docker para iniciar el contenedor efímero.
  - La base de datos de producción/staging remota permanece estrictamente intacta conforme a la restricción arquitectónica del proyecto.
- **Verificación realizada**:
  - Validación estricta del esquema con `prisma validate` (exit code 0).
  - Generación del cliente Prisma 7 con `prisma generate` (exit code 0).
  - Generación del DDL completo reproducible con `prisma migrate diff` a [migration.sql](file:///apps/api/prisma/migrations/20261011000000_init/migration.sql).
  - Health checks `/live` (200 OK) y `/ready` (503 cuando la base de datos no está disponible) validados mediante pruebas de integración con NestJS.
