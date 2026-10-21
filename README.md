# Cubiora

Sistema web presencial de gestión de turnos para entrega de medicamentos en dispensarios y farmacias hospitalarias.

---

## 🎯 Alcance del Proyecto
Cubiora optimiza el flujo presencial de atención de medicamentos:
1. **Registro**: Emisión del turno presencial al paciente.
2. **Cola**: Gestión de la cola en orden FIFO.
3. **Llamado**: Notificación visual y sonora en pantalla de sala de espera asignando un cubículo disponible.
4. **Atención**: Despacho del turno por el operador del cubículo.
5. **Cierre / No Presentado**: Conclusión de la atención o reintento de llamado.

> **Fuera de Alcance:** No gestiona inventario ni stock de medicamentos, fórmulas médicas ni historias clínicas.

---

## 🏗️ Stack Tecnológico
- **Monorepo:** `pnpm` workspaces (v12.11.2)
- **Backend:** NestJS 12, Node.js 22 LTS, TypeScript en modo estricto
- **Base de Datos & ORM:** PostgreSQL 16+, Prisma 7 con driver adapter `@prisma/adapter-pg`
- **Frontend:** React 19, TypeScript, Vite 8, TanStack Query, React Hook Form, React Router v7
- **Testing:** Vitest 5 con `@testing-library/react` y soporte SWC para decoradores
- **Contenedores:** Docker & Docker Compose para desarrollo local

---

## 📁 Estructura del Monorepo

```
Cubiora/
├── .github/workflows/    # CI Pipeline (GitHub Actions)
├── apps/
│   ├── api/              # Backend modular en NestJS 12
│   └── web/              # Frontend SPA en React + Vite
├── packages/
│   └── shared/           # Tipos, enums y contratos compartidos (sin lógica de negocio)
├── docker/               # Dockerfiles (api, web) y configuración Nginx
├── docs/                 # Arquitectura (Mermaid) y ADRs (PostgreSQL, Sesiones)
├── docker-compose.dev.yml# PostgreSQL efímero local
├── pnpm-workspace.yaml   # Configuración de espacios de trabajo
└── package.json          # Scripts raíz del monorepo
```

---

## 🚀 Inicio Rápido (Desarrollo Local)

### 1. Requisitos Previos
- Node.js >= 22.0.0
- pnpm >= 12.11.2
- Docker & Docker Compose

### 2. Configuración de Entorno
Copia los archivos de ejemplo de variables de entorno:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 3. Levantar la Base de Datos Local
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 4. Instalar Dependencias
```bash
pnpm install --frozen-lockfile
```

### 5. Generar Cliente Prisma y Ejecutar Migraciones
```bash
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
```

### 6. Iniciar Servidores de Desarrollo
```bash
pnpm dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000` (con prefijo `/api/v1`)
- Liveness check: `http://localhost:3000/api/v1/health/live`
- Readiness check: `http://localhost:3000/api/v1/health/ready`

---

## 📜 Comandos Disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia apps/api y apps/web en paralelo |
| `pnpm build` | Compila shared, api y web para producción |
| `pnpm lint` | Ejecuta ESLint en todo el monorepo |
| `pnpm typecheck` | Valida tipos de TypeScript sin emitir código |
| `pnpm test` | Ejecuta la suite de pruebas unitarias con Vitest |
| `pnpm db:generate` | Genera el cliente Prisma tipado |
| `pnpm db:migrate:dev` | Aplica migraciones pendientes en la BD local |
| `pnpm db:seed` | Carga cubículos y usuarios de prueba |

---

## 🔒 Seguridad y Privacidad de Datos
- **Privacidad en Sala de Espera:** La pantalla pública (`/pantalla`) jamás expone nombres ni documentos de pacientes (`patientName`, `patientDocument`), usando exclusivamente el tipo seguro `PublicCall`.
- **Mínimo Privilegio:** La aplicación en tiempo de ejecución se conecta como `cubiora_app` sin permisos de alteración de esquema (DDL).
- **Inmutabilidad:** Las trazas de auditoría (`ticket_audits`) están protegidas a nivel de base de datos para impedir cualquier modificación o eliminación.

---

## 📄 Documentación y Decisiones
- [Arquitectura del Sistema](file:///docs/architecture.md)
- [ADR 0001: PostgreSQL](file:///docs/adr/0001-postgresql.md)
- [ADR 0002: Sesiones de Servidor](file:///docs/adr/0002-sesiones.md)
- [Decisiones Pendientes de Aprobación](file:///docs/decisiones-pendientes.md)