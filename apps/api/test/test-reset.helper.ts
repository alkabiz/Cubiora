import { PrismaClient } from '../src/generated/prisma/client';
import { UserRole } from '@cubiora/shared';
import * as bcrypt from 'bcryptjs';
import { ulid } from 'ulid';

/**
 * Helper de reinicio exclusivo para suites de pruebas automatizadas.
 * 
 * Salvaguardas críticas mandatorias:
 * 1. Solo opera con NODE_ENV === 'test'.
 * 2. Solo opera sobre bases de datos cuyo nombre termine estrictamente en '_test'.
 * 3. Se niega categóricamente a ejecutarse en entornos de staging o producción.
 * 4. Ejecuta todas las operaciones dentro de una transacción atómica.
 * 5. Reconstruye fixtures de forma determinista y limpia.
 * 6. NO se exporta desde módulos de src/ (permanece aislado en test/).
 */
export async function resetTestDatabase(
  prisma: PrismaClient,
  databaseUrl: string,
): Promise<void> {
  // 1. Salvaguarda de entorno NODE_ENV
  if (process.env['NODE_ENV'] !== 'test') {
    throw new Error(
      `FATAL_TEST_RESET_VIOLATION: resetTestDatabase solo está permitido con NODE_ENV=test. Entorno detectado: '${process.env['NODE_ENV']}'.`,
    );
  }

  // 2. Salvaguarda de sufijo _test en base de datos
  let dbName = '';
  try {
    const parsed = new URL(databaseUrl);
    dbName = parsed.pathname.replace(/^\//, '');
  } catch {
    throw new Error(
      'FATAL_TEST_RESET_VIOLATION: databaseUrl provista no es una URL válida.',
    );
  }

  if (!dbName.endsWith('_test')) {
    throw new Error(
      `FATAL_TEST_RESET_VIOLATION: Operación destructiva denegada. resetTestDatabase solo puede operar en bases terminadas en '_test'. Base de datos detectada: '${dbName}'.`,
    );
  }

  // 3. Ejecución en transacción atómica aislada
  await prisma.$transaction(async (tx) => {
    // A. Limpieza de tablas de datos volátiles y de auditoría en orden inverso de dependencias
    await tx.ticketStatusHistory.deleteMany({});
    await tx.ticketCall.deleteMany({});
    await tx.idempotencyKey.deleteMany({});
    await tx.ticket.deleteMany({});

    // B. Reconstrucción de secuencia
    await tx.systemSequence.upsert({
      where: { sequenceName: 'ticket_public_sequence' },
      update: { nextValue: 1n },
      create: { sequenceName: 'ticket_public_sequence', nextValue: 1n },
    });

    await tx.systemSequence.upsert({
      where: { sequenceName: 'TICKETS' },
      update: { nextValue: 1n },
      create: { sequenceName: 'TICKETS', nextValue: 1n },
    });

    // C. Reconstrucción de cubículos con display_name oficial
    const cubicles = [
      { id: ulid(), code: 'CUB-01', displayName: 'Cubículo 01', status: 'AVAILABLE' as const, version: 1 },
      { id: ulid(), code: 'CUB-02', displayName: 'Cubículo 02', status: 'AVAILABLE' as const, version: 1 },
      { id: ulid(), code: 'CUB-03', displayName: 'Cubículo 03', status: 'AVAILABLE' as const, version: 1 },
    ];

    const cubicleIds = new Map<string, string>();
    for (const cubicle of cubicles) {
      const persisted = await tx.cubicle.upsert({
        where: { code: cubicle.code },
        update: {
          displayName: cubicle.displayName,
          status: 'AVAILABLE',
          version: 1,
        },
        create: cubicle,
      });
      cubicleIds.set(persisted.code, persisted.id);
    }

    // D. Reconstrucción de usuarios fixture
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('TestPassword123!', salt);

    const testUsers = [
      {
        id: ulid(),
        publicId: ulid(),
        username: 'recepcion_test',
        displayName: 'Recepcionista Test',
        role: UserRole.RECEPTION,
        cubicleId: null,
        passwordHash,
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'cajero_test',
        displayName: 'Cajero Test',
        role: UserRole.CASHIER,
        cubicleId: cubicleIds.get('CUB-03') ?? null,
        passwordHash,
      },
      {
        id: ulid(),
        publicId: ulid(),
        username: 'admin_test',
        displayName: 'Admin Test',
        role: UserRole.ADMIN,
        cubicleId: null,
        passwordHash,
      },
    ];

    for (const u of testUsers) {
      await tx.user.upsert({
        where: { username: u.username },
        update: {
          role: u.role,
          cubicleId: u.cubicleId,
          passwordHash,
        },
        create: u,
      });
    }
  });
}
