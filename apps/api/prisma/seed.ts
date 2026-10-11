import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  'postgresql://cubiora_migrator:cubiora_dev_secret@localhost:5432/cubiora_dev?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de desarrollo para Cubiora...');

  // 1. Cubículos iniciales (Q1: 3 cubículos en desarrollo)
  const cubiclesData = [
    { number: 1, name: 'Cubículo 1', status: 'ACTIVE' as const },
    { number: 2, name: 'Cubículo 2', status: 'ACTIVE' as const },
    { number: 3, name: 'Cubículo 3', status: 'ACTIVE' as const },
  ];

  for (const cubicle of cubiclesData) {
    await prisma.cubicle.upsert({
      where: { number: cubicle.number },
      update: { name: cubicle.name, status: cubicle.status },
      create: cubicle,
    });
  }
  console.log('✅ 3 Cubículos asegurados (Cubículo 1, 2 y 3)');

  // 2. Usuarios de prueba para desarrollo local
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('cubiora123', salt);

  const testUsers = [
    {
      username: 'recepcion',
      name: 'Recepcionista Turnos',
      role: 'RECEPTION' as const,
      passwordHash: defaultPasswordHash,
    },
    {
      username: 'cajero1',
      name: 'Atención Cubículo 1',
      role: 'CASHIER' as const,
      passwordHash: defaultPasswordHash,
    },
    {
      username: 'admin',
      name: 'Administrador Sistema',
      role: 'ADMIN' as const,
      passwordHash: defaultPasswordHash,
    },
  ];

  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: { role: user.role, name: user.name },
      create: user,
    });
  }
  console.log('✅ Usuarios de prueba creados (recepcion, cajero1, admin)');

  console.log('🌱 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
