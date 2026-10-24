import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { ulid } from 'ulid';

// Carga prioritaria de variables de desarrollo local ignoradas por git (.env.development.local)
// NUNCA cargar apps/api/.env ni llamar a dotenv.config() sin ruta específica.
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });

// 1. Salvaguarda crítica: jamás ejecutar seed en producción
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR FATAL: El seed de datos de prueba está estrictamente prohibido en NODE_ENV=production.');
  process.exit(1);
}

// 2. Validación de cadena de conexión requerida
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ ERROR CONFIGURACIÓN: DIRECT_URL o DATABASE_URL es obligatoria para ejecutar el seed.');
  process.exit(1);
}

// 3. Guarda de host local: prohibida cualquier IP o dominio externo
try {
  const parsedUrl = new URL(connectionString);
  const host = parsedUrl.hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error(
      `❌ ERROR_SEGURIDAD_HOST_NO_LOCAL: El seed solo puede ejecutarse contra localhost, 127.0.0.1 o ::1. Host detectado: '${host}'. Conexión remota prohibida.`,
    );
    process.exit(1);
  }
} catch {
  console.error('❌ ERROR CONFIGURACIÓN: La cadena de conexión del seed no es una URL válida.');
  process.exit(1);
}

// 4. Exigir contraseña obligatoria por entorno (sin contraseñas por defecto)
const devPassword = process.env.DEV_SEED_USER_PASSWORD;
if (!devPassword || devPassword.length < 8) {
  console.error(
    '❌ ERROR DE SEGURIDAD: La variable DEV_SEED_USER_PASSWORD es obligatoria en el entorno (mínimo 8 caracteres) para crear usuarios de prueba.',
  );
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de desarrollo para Cubiora...');

  // 1. Cubículos iniciales (Q1: 3 cubículos en desarrollo: CUB-01, CUB-02, CUB-03)
  const cubiclesData = [
    { id: ulid(), code: 'CUB-01', displayName: 'Cubículo 01', status: 'AVAILABLE' as const },
    { id: ulid(), code: 'CUB-02', displayName: 'Cubículo 02', status: 'AVAILABLE' as const },
    { id: ulid(), code: 'CUB-03', displayName: 'Cubículo 03', status: 'AVAILABLE' as const },
  ];

  const cubicleIds = new Map<string, string>();
  for (const cubicle of cubiclesData) {
    const persisted = await prisma.cubicle.upsert({
      where: { code: cubicle.code },
      update: { displayName: cubicle.displayName },
      create: cubicle,
    });
    cubicleIds.set(persisted.code, persisted.id);
  }
  console.log('✅ 3 Cubículos asegurados (CUB-01, CUB-02, CUB-03)');

  // 2. Secuencia del sistema para numeración de turnos (sin huecos)
  await prisma.systemSequence.upsert({
    where: { sequenceName: 'ticket_public_sequence' },
    update: {},
    create: { sequenceName: 'ticket_public_sequence', nextValue: 1n },
  });
  console.log('✅ Secuencia de turnos (ticket_public_sequence) inicializada');

  // 3. Usuarios de prueba para desarrollo local con publicId e id ULID válidos
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(devPassword, salt);

  const testUsers = [
    {
      id: ulid(),
      publicId: ulid(),
      username: 'receptor',
      displayName: 'Recepción de Farmacia',
      role: 'RECEPTION' as const,
      cubicleId: null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'cajero',
      displayName: 'Atención Cubículo 03',
      role: 'CASHIER' as const,
      cubicleId: cubicleIds.get('CUB-03') ?? null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'recepcion',
      displayName: 'Recepcionista Turnos',
      role: 'RECEPTION' as const,
      cubicleId: null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'cajero1',
      displayName: 'Atención Cubículo 01',
      role: 'CASHIER' as const,
      cubicleId: cubicleIds.get('CUB-01') ?? null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'admin',
      displayName: 'Administrador Sistema',
      role: 'ADMIN' as const,
      cubicleId: null,
      passwordHash,
    },
  ];

  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        // No sobrescribir credenciales si el usuario ya existe, pero sí
        // mantener determinista la asignación de cubículo en desarrollo.
        cubicleId: user.cubicleId,
      },
      create: user,
    });
  }
  console.log('✅ Usuarios de prueba asegurados (receptor, cajero, recepcion, cajero1, admin)');
  console.log('🌱 Seed de desarrollo completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
