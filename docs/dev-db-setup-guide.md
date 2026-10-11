# Guía de Configuración Local de Base de Datos — Cubiora (PostgreSQL 18)

Esta guía detalla los pasos para inicializar tu base de datos de desarrollo local en PostgreSQL 18 para Windows, garantizando que **ninguna contraseña quede registrada en el repositorio**.

---

## Paso 1: Generar contraseñas seguras

Abre una terminal (PowerShell o Git Bash) y genera contraseñas aleatorias seguras mediante `openssl`:

```bash
# Contraseña para el rol migrador (Prisma CLI / migraciones)
MIGRATOR_PASS=$(openssl rand -base64 32)
echo "MIGRATOR_PASS: $MIGRATOR_PASS"

# Contraseña para el rol de aplicación (NestJS runtime)
APP_PASS=$(openssl rand -base64 32)
echo "APP_PASS: $APP_PASS"

# Secreto para sesiones HTTP-only
SESSION_SEC=$(openssl rand -base64 32)
echo "SESSION_SEC: $SESSION_SEC"

# Token opaco para pantalla pública
DISPLAY_TOK=$(openssl rand -base64 32)
echo "DISPLAY_TOK: $DISPLAY_TOK"
```

> **Nota**: En PowerShell en Windows puedes ejecutar:
> ```powershell
> $MigratorPass = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 } | ForEach-Object { [byte]$_ }))
> $AppPass = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 } | ForEach-Object { [byte]$_ }))
> $SessionSec = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 } | ForEach-Object { [byte]$_ }))
> $DisplayTok = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 } | ForEach-Object { [byte]$_ }))
> Write-Host "MIGRATOR: $MigratorPass"
> Write-Host "APP: $AppPass"
> ```

---

## Paso 2: Ejecutar el script SQL de inicialización

Con tu usuario administrador local de PostgreSQL (`postgres`), ejecuta el script parametrizado [dev-db-setup.sql](file:///c:/Users/Juan%20Jos%C3%A9%20Henao%20G/Desktop/Cubiora/docs/dev-db-setup.sql):

```bash
psql -U postgres -h localhost -v MIGRATOR_PASSWORD="$MIGRATOR_PASS" -v APP_PASSWORD="$APP_PASS" -f docs/dev-db-setup.sql
```

En PowerShell:
```powershell
psql -U postgres -h localhost -v MIGRATOR_PASSWORD="'$MigratorPass'" -v APP_PASSWORD="'$AppPass'" -f docs/dev-db-setup.sql
```

---

## Paso 3: Crear tu archivo `.env.development.local`

Copia la plantilla [apps/api/.env.example](file:///c:/Users/Juan%20Jos%C3%A9%20Henao%20G/Desktop/Cubiora/apps/api/.env.example) a la raíz como `.env.development.local` (el cual está protegido e ignorado por `.gitignore`):

```env
NODE_ENV=development
PORT=3000

# Base de datos local (PostgreSQL 18 en localhost)
DATABASE_URL="postgresql://cubiora_app:<TU_APP_PASSWORD>@localhost:5432/cubiora_dev?schema=public"
DIRECT_URL="postgresql://cubiora_migrator:<TU_MIGRATOR_PASSWORD>@localhost:5432/cubiora_dev?schema=public"

# Seguridad
SESSION_SECRET="<TU_SESSION_SECRET>"
DISPLAY_TOKEN="<TU_DISPLAY_TOKEN>"
CORS_ORIGINS="http://localhost:5173"

# Seed de desarrollo
DEV_SEED_USER_PASSWORD="DevPassword123!"

# Configuración
LOG_LEVEL=debug
NO_SHOW_MAX_CALLS=3
```

---

## Paso 4: Ejecutar migraciones y seed

Una vez configurada la base de datos local:

```bash
# Desplegar esquema inicial Prisma
pnpm db:generate
pnpm --filter api prisma:migrate:dev

# Cargar cubículos y secuencia inicial
pnpm db:seed
```
