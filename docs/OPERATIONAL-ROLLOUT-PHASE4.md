# Guía Operativa de Despliegue y Cierre de Endurecimiento (Fase 4)

Este documento consolida los pasos operativos manuales fuera del repositorio para completar la puesta en marcha segura en **Coolify + PostgreSQL externo + GitHub**, complementando los controles ya automatizados en el código fuente.

---

## 1. Base de Datos PostgreSQL y Variables en Coolify

### 1.1. Generación de secretos y contraseñas fuertes

En Linux/macOS/Git Bash (evitar `+`/`/` en contraseñas de URI usando hexadecimal para PostgreSQL):

```bash
# Contraseñas seguras para roles PostgreSQL (48 hex chars = 192 bits, sin caracteres reservados de URL)
NEW_APP_PASS=$(openssl rand -hex 24)
NEW_MIGRATOR_PASS=$(openssl rand -hex 24)

# Secretos de aplicación (>= 32 chars base64)
NEW_SESSION_SECRET=$(openssl rand -base64 32)
NEW_DISPLAY_TOKEN=$(openssl rand -base64 32)
NEW_WMS_WEBHOOK_SECRET=$(openssl rand -base64 32)
```

### 1.2. Rotación coordinada de roles en PostgreSQL (sin caída)

> **Importante:** Ejecute la rotación en PostgreSQL e **inmediatamente** actualice `DATABASE_URL` y `DIRECT_URL` en Coolify antes de redeployar para evitar errores `28P01` de autenticación.

Conectado como superusuario (`postgres`) o rol administrador en PostgreSQL sobre `cubiora_db`:

```sql
-- Sustituya <<NEW_APP_PASSWORD>> y <<NEW_MIGRATOR_PASSWORD>> al ejecutar psql -v
ALTER ROLE cubiora_app WITH PASSWORD :'NEW_APP_PASS';
ALTER ROLE cubiora_migrator WITH PASSWORD :'NEW_MIGRATOR_PASS';
```

Si alguno de los roles aún no existe en el servidor destino, verifique los permisos y estructura base definidos en [dev-db-setup.sql](dev-db-setup.sql) y [migration.sql (Fase 4)](../apps/api/prisma/migrations/20261111180000_security_hardening_phase4/migration.sql).

### 1.3. Migración formal Fase 4 y verificación post-despliegue

El contenedor `api` ejecuta automáticamente `prisma migrate deploy` durante el arranque ([entrypoint.api.sh](../docker/entrypoint.api.sh)) usando `DIRECT_URL` (`cubiora_migrator`) si está definida, propagando además la CA institucional vía `NODE_EXTRA_CA_CERTS` y `sslrootcert` (tanto si se entrega por `DATABASE_CA_CERT_PATH` como inline en `DATABASE_CA_CERT`). También puede validarse manualmente desde un entorno de producción controlado (`NODE_ENV=production`):

```bash
NODE_ENV=production \
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/cubiora-db-ca.crt \
DIRECT_URL="postgresql://cubiora_migrator:${NEW_MIGRATOR_PASS}@<HOST_OR_FQDN>:5432/cubiora_db?schema=public&sslmode=verify-full&sslrootcert=/etc/ssl/certs/cubiora-db-ca.crt" \
  pnpm --filter api exec prisma migrate deploy
```

> Nota: `apps/api/prisma.config.ts` bloquea intencionalmente conexiones remotas cuando `NODE_ENV !== 'production'`. No deshabilite esta protección en desarrollo local; asegúrese de que `.env.development.local` apunte exclusivamente a `localhost` / `postgres`.

Luego ejecute el script de solo lectura [verify-phase4-postdeploy.sql](sql/verify-phase4-postdeploy.sql) contra PostgreSQL para confirmar:
- Conexión TLS activa (`pg_stat_ssl.ssl = true`).
- Migración `20261111180000_security_hardening_phase4` aplicada sin errores ni rollbacks.
- Columna `users.token_version`, índice `uq_pharmacists_cubicle_assigned` y triggers WORM en `dispensation_records`.
- Matriz de mínimo privilegio para `cubiora_app` (sin `DELETE` en tablas núcleo/WORM ni acceso a `_prisma_migrations`) y `REVOKE CREATE ON SCHEMA public FROM PUBLIC`.

### 1.4. Configuración de variables en Coolify (`docker-compose.yaml`)

Revise la plantilla oficial en [.env.production.example](../.env.production.example) y valide en la UI de Coolify:

1. **TLS y certificado CA:**
   - Defina `DATABASE_URL` con `cubiora_app` y `?schema=public&sslmode=verify-full`.
   - Defina `DIRECT_URL` con `cubiora_migrator` y `?schema=public&sslmode=verify-full` (necesaria en `api` para que `entrypoint.api.sh` ejecute migraciones DDL con privilegio separado; si migra fuera de banda, puede dejarse vacía en runtime).
   - Mantenga `ALLOW_DOCKER_INTERNAL_DB=false` y `ALLOW_VERIFY_CA_EXCEPTION=false`.
   - Entregue la CA mediante archivo montado (`DATABASE_CA_CERT_PATH=/etc/ssl/certs/cubiora-db-ca.crt`) **o** inline en `DATABASE_CA_CERT` (el arranque normaliza automáticamente escapes `\n`/`\r\n` y comillas).
   - **Si temporalmente se conecta por IP numérica con SAN IP en el certificado:** active `ALLOW_NUMERIC_IP_EXCEPTION=true` junto con `sslmode=verify-full` y el certificado CA correspondiente. Migre a FQDN interno (ej. `postgres.internal`) y cambie a `ALLOW_NUMERIC_IP_EXCEPTION=false` tan pronto el DNS interno esté operativo.
2. **Cookies, sesiones e integraciones:**
   - `COOKIE_SECURE=true` (verificando que Coolify/Traefik o Cloudflared reenvíe `X-Forwarded-Proto: https`).
   - `CORS_ORIGINS=https://cubiora.samlapspeed.com`
   - `SESSION_SECRET`, `DISPLAY_TOKEN` (opcional, mínimo 32 chars) y `WMS_WEBHOOK_SECRET` (si usa `WMS_WEBHOOK_URL`).
3. **Seed de arranque:**
   - Mantenga `RUN_SEED_ON_BOOT=false` y `RESET_SEED_PASSWORDS=false` tras inicializar los datos base.
   - Si necesita ejecutar seed inicial en producción (`RUN_SEED_ON_BOOT=true`), proporcione contraseñas distintas y robustas (>= 12 chars) en `DEFAULT_ADMIN_PASSWORD` y `DEV_SEED_USER_PASSWORD`, y desactive `RUN_SEED_ON_BOOT=false` al finalizar.

---

## 2. Controles Externos en GitHub (Branch Protection y Environments)

El flujo de despliegue [cd.yml](../.github/workflows/cd.yml) ya invoca automáticamente al flujo completo de [ci.yml](../.github/workflows/ci.yml) (`verify` via `workflow_call`) antes de llegar al gate de producción y publicar contenedores.

Para completar la gobernanza en GitHub (**Settings** del repositorio):

1. **Protección de rama `main` (`Settings -> Branches` / `Rulesets`):**
   - Activar **Require a pull request before merging** (recomendado mínimo 1 aprobación para cambios directos).
   - Activar **Require status checks to pass before merging** y seleccionar como obligatorios:
     - `Security & Secret Scanning`
     - `Lint & Typecheck`
     - `Automated Tests (Vitest & PostgreSQL)`
     - `Production Build`
     - `Docker Build Validation`
     - `CodeQL SAST Analysis`
   - Activar **Do not allow bypassing the above settings**.
2. **Ambiente `production` (`Settings -> Environments -> production`):**
   - Configurar **Required reviewers** con los responsables técnicos autorizados antes de aprobar el job `Production Approval Gate` (`deployment-gate`).
   - Limitar **Deployment branches and tags** exclusivamente a `main` y tags `v*.*.*`.
3. **Seguridad avanzada (`Settings -> Code security`):**
   - Verificar activos **Secret scanning** y **Push protection** (complementa Gitleaks en CI).

---

## 3. Verificación Rápida de Runtime Post-Deploy

Una vez desplegado en producción:

1. `GET https://cubiora.samlapspeed.com/api/v1/health/live` -> HTTP `200`.
2. `GET https://cubiora.samlapspeed.com/api/v1/health/ready` -> HTTP `200` (confirma conectividad real TLS a PostgreSQL).
3. Inspeccionar cabeceras de respuesta sobre `/`, `/api/v1/health/live` y `/socket.io/`:
   - Presencia de `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`.
   - Ausencia de `X-Powered-By` y versión de Nginx (`Server: nginx`).
4. Confirmar conexión WebSocket (`wss://cubiora.samlapspeed.com/socket.io/`) autenticada y expiración limpia tras cambio de contraseña o cierre de sesión (`token_version`).
