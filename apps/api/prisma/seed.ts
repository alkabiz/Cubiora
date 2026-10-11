import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

// Salvaguarda crítica: jamás ejecutar seed en producción
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR FATAL: El seed de datos de prueba está estrictamente prohibido en NODE_ENV=production.');
  process.exit(1);
}

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  'postgresql://cubiora_migrator:cubiora_dev_secret@localhost:5432/cubiora_dev?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de desarrollo para Cubiora...');

  // 1. Cubículos iniciales (Q1: 3 cubículos en desarrollo: CUB-01, CUB-02, CUB-03)
  const cubiclesData = [
    { code: 'CUB-01', displayName: 'Cubículo 1', status: 'AVAILABLE' as const },
    { code: 'CUB-02', displayName: 'Cubículo 2', status: 'AVAILABLE' as const },
    { code: 'CUB-03', displayName: 'Cubículo 3', status: 'AVAILABLE' as const },
  ];

  for (const cubicle of cubiclesData) {
    await prisma.cubicle.upsert({
      where: { code: cubicle.code },
      update: { displayName: cubicle.displayName, status: cubicle.status },
      create: cubicle,
    });
  }
  console.log('✅ 3 Cubículos asegurados (CUB-01, CUB-02, CUB-03)');

  // 2. Secuencia del sistema para numeración de turnos
  await prisma.systemSequence.upsert({
    where: { sequenceName: 'ticket_public_sequence' },
    update: {},
    create: { sequenceName: 'ticket_public_sequence', nextValue: 1n },
  });
  console.log('✅ Secuencia de turnos (ticket_public_sequence) inicializada');

  // 3. Usuarios de prueba para desarrollo local (contraseñas obtenidas de variable de entorno o fallback seguro de dev)
  const devPassword = process.env.DEV_SEED_USER_PASSWORD || 'DevPassword123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(devPassword, salt);

  const testUsers = [
    {
      username: 'recepcion',
      displayName: 'Recepcionista Turnos',
      role: 'RECEPTION' as const,
      passwordHash,
    },
    {
      username: 'cajero1',
      displayName: 'Atención Cubículo 1',
      role: 'CASHIER' as const,
      passwordHash,
    },
    {
      username: 'admin',
      displayName: 'Administrador Sistema',
      role: 'ADMIN' as const,
      passwordHash,
    },
  ];

  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: { displayName: user.displayName, role: user.role, passwordHash: user.passwordHash },
      create: user,
    });
  }
  console.log('✅ 3 Usuarios de prueba asegurados (recepcion, cajero1, admin)');
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
