import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  PrismaClient,
  QueueCategory,
  CubicleStatus,
  TicketStatus,
  DispensationResolution,
  UserRole,
} from '../src/generated/prisma/client';
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
  console.log('🌱 Iniciando seed de desarrollo para Cubiora (Topología Audifarma PMV)...');

  // 1. Cubículos parametrizados (Topología Audifarma PMV)
  const cubiclesData = [
    {
      code: 'CUB-01',
      displayName: 'Cubículo 01',
      operatorName: 'Lic. M. Arismendi',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.PREFERENTIAL, QueueCategory.GENERAL],
    },
    {
      code: 'CUB-02',
      displayName: 'Cubículo 02',
      operatorName: 'Farm. J. Duarte',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.PREFERENTIAL],
    },
    {
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      operatorName: 'Lic. R. Mendoza',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.BILLING],
    },
    {
      code: 'CUB-04',
      displayName: 'Cubículo 04',
      operatorName: 'Farm. S. Quintero',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.HIGH_COST, QueueCategory.PREFERENTIAL],
    },
    {
      code: 'CUB-05',
      displayName: 'Cubículo 05',
      operatorName: 'Farm. Auxiliar Guardia',
      status: CubicleStatus.INACTIVE,
      active: false,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.HIGH_COST],
    },
  ];

  const cubicleIds = new Map<string, string>();
  for (const cubicle of cubiclesData) {
    const persisted = await prisma.cubicle.upsert({
      where: { code: cubicle.code },
      update: {
        displayName: cubicle.displayName,
        operatorName: cubicle.operatorName,
        status: cubicle.status,
        active: cubicle.active,
        allowedCategories: cubicle.allowedCategories,
      },
      create: {
        id: ulid(),
        code: cubicle.code,
        displayName: cubicle.displayName,
        operatorName: cubicle.operatorName,
        status: cubicle.status,
        active: cubicle.active,
        allowedCategories: cubicle.allowedCategories,
      },
    });
    cubicleIds.set(persisted.code, persisted.id);
  }
  console.log('✅ 5 Cubículos asegurados (CUB-01 .. CUB-05) con allowedCategories y operatorName');

  // 2. Usuarios de prueba para desarrollo local con publicId e id ULID válidos
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(devPassword, salt);

  const testUsers = [
    {
      id: ulid(),
      publicId: ulid(),
      username: 'receptor',
      displayName: 'Recepción de Farmacia',
      role: UserRole.RECEPTION,
      cubicleId: null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'recepcion',
      displayName: 'Recepcionista Turnos',
      role: UserRole.RECEPTION,
      cubicleId: null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'admin',
      displayName: 'Administrador Sistema',
      role: UserRole.ADMIN,
      cubicleId: null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'cajero1',
      displayName: 'Lic. M. Arismendi',
      role: UserRole.CASHIER,
      cubicleId: cubicleIds.get('CUB-01') ?? null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'cajero2',
      displayName: 'Farm. J. Duarte',
      role: UserRole.CASHIER,
      cubicleId: cubicleIds.get('CUB-02') ?? null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'cajero',
      displayName: 'Lic. R. Mendoza',
      role: UserRole.CASHIER,
      cubicleId: cubicleIds.get('CUB-03') ?? null,
      passwordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'cajero4',
      displayName: 'Farm. S. Quintero',
      role: UserRole.CASHIER,
      cubicleId: cubicleIds.get('CUB-04') ?? null,
      passwordHash,
    },
  ];

  const userIds = new Map<string, string>();
  for (const user of testUsers) {
    const persisted = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        cubicleId: user.cubicleId,
        displayName: user.displayName,
        role: user.role,
      },
      create: user,
    });
    userIds.set(persisted.username, persisted.id);
  }
  console.log('✅ Usuarios de prueba asegurados con asignación a cubículos CUB-01..CUB-04');

  const defaultCreatorId = userIds.get('recepcion') ?? userIds.get('receptor') ?? userIds.get('admin')!;
  const now = new Date();

  // 3. Muestra inicial de turnos cerrados con dispensación (Resolución 1604 MinSalud)
  const closedTicketsData = [
    {
      sequenceNumber: 1n,
      publicCode: 'TUR-000001-PR',
      queueCategory: QueueCategory.PREFERENTIAL,
      patientName: 'Héctor Fabio Ramírez',
      patientDocument: '70123456',
      prescriptionBarcode: 'RX-2026-00101',
      preferentialReason: 'SIAU_ADULTO_MAYOR',
      terminalReason: 'DISPENSED_PENDING_48H',
      cubicleCode: 'CUB-01',
      operatorUsername: 'cajero1',
      createdOffsetMinutes: 120,
      calledOffsetMinutes: 115,
      serviceStartedOffsetMinutes: 114,
      closedOffsetMinutes: 105,
      dispensation: {
        resolution: DispensationResolution.PENDING_48H,
        prescriptionCode: 'RX-2026-00101',
        mipresNumber: '202611070001',
        itemsDeliveredCount: 2,
        itemsPendingCount: 1,
        pendingDetailsJson: [
          {
            itemCode: 'MED-771',
            description: 'Insulina Glargina 100 UI/ml',
            quantity: 2,
            reason: 'Agotamiento temporal cadena de frío',
          },
        ],
        deliveryAddress: 'Calle 10 # 42-28, Apto 502, El Poblado, Medellín',
        deliveryPhone: '+57 311 555 4321',
        deliveryDeadline: new Date(now.getTime() - 105 * 60 * 1000 + 48 * 3600 * 1000),
      },
    },
    {
      sequenceNumber: 2n,
      publicCode: 'TUR-000002-GE',
      queueCategory: QueueCategory.GENERAL,
      patientName: 'Carolina Gómez Zapata',
      patientDocument: '1017234567',
      prescriptionBarcode: 'RX-2026-00102',
      preferentialReason: null,
      terminalReason: 'TOTAL_DELIVERED',
      cubicleCode: 'CUB-02',
      operatorUsername: 'cajero2',
      createdOffsetMinutes: 100,
      calledOffsetMinutes: 92,
      serviceStartedOffsetMinutes: 91,
      closedOffsetMinutes: 85,
      dispensation: {
        resolution: DispensationResolution.TOTAL_DELIVERED,
        prescriptionCode: 'RX-2026-00102',
        mipresNumber: null,
        itemsDeliveredCount: 3,
        itemsPendingCount: 0,
        pendingDetailsJson: null,
        deliveryAddress: null,
        deliveryPhone: null,
        deliveryDeadline: null,
      },
    },
    {
      sequenceNumber: 3n,
      publicCode: 'TUR-000003-GE',
      queueCategory: QueueCategory.GENERAL,
      patientName: 'Mateo Morales Hincapié',
      patientDocument: '1036789012',
      prescriptionBarcode: 'RX-2026-00103',
      preferentialReason: null,
      terminalReason: 'TOTAL_DELIVERED',
      cubicleCode: 'CUB-03',
      operatorUsername: 'cajero',
      createdOffsetMinutes: 80,
      calledOffsetMinutes: 71,
      serviceStartedOffsetMinutes: 70,
      closedOffsetMinutes: 62,
      dispensation: {
        resolution: DispensationResolution.TOTAL_DELIVERED,
        prescriptionCode: 'RX-2026-00103',
        mipresNumber: null,
        itemsDeliveredCount: 4,
        itemsPendingCount: 0,
        pendingDetailsJson: null,
        deliveryAddress: null,
        deliveryPhone: null,
        deliveryDeadline: null,
      },
    },
    {
      sequenceNumber: 4n,
      publicCode: 'TUR-000004-FA',
      queueCategory: QueueCategory.BILLING,
      patientName: 'Valentina Restrepo Castro',
      patientDocument: '1020304050',
      prescriptionBarcode: 'RX-2026-00104',
      preferentialReason: null,
      terminalReason: 'TOTAL_DELIVERED',
      cubicleCode: 'CUB-03',
      operatorUsername: 'cajero',
      createdOffsetMinutes: 60,
      calledOffsetMinutes: 54,
      serviceStartedOffsetMinutes: 53,
      closedOffsetMinutes: 48,
      dispensation: {
        resolution: DispensationResolution.TOTAL_DELIVERED,
        prescriptionCode: 'RX-2026-00104',
        mipresNumber: null,
        itemsDeliveredCount: 1,
        itemsPendingCount: 0,
        pendingDetailsJson: null,
        deliveryAddress: null,
        deliveryPhone: null,
        deliveryDeadline: null,
      },
    },
  ];

  for (const item of closedTicketsData) {
    const cubicleId = cubicleIds.get(item.cubicleCode) ?? null;
    const operatorUserId = userIds.get(item.operatorUsername) ?? defaultCreatorId;
    const createdAt = new Date(now.getTime() - item.createdOffsetMinutes * 60 * 1000);
    const calledAt = new Date(now.getTime() - item.calledOffsetMinutes * 60 * 1000);
    const serviceStartedAt = new Date(now.getTime() - item.serviceStartedOffsetMinutes * 60 * 1000);
    const closedAt = new Date(now.getTime() - item.closedOffsetMinutes * 60 * 1000);

    const ticket = await prisma.ticket.upsert({
      where: { publicCode: item.publicCode },
      update: {
        status: TicketStatus.CLOSED,
        queueCategory: item.queueCategory,
        patientName: item.patientName,
        patientDocument: item.patientDocument,
        prescriptionBarcode: item.prescriptionBarcode,
        preferentialReason: item.preferentialReason,
        cubicleId,
        assignedAt: calledAt,
        calledAt,
        serviceStartedAt,
        closedAt,
        terminalReason: item.terminalReason,
      },
      create: {
        id: ulid(),
        publicId: ulid(),
        sequenceNumber: item.sequenceNumber,
        publicCode: item.publicCode,
        status: TicketStatus.CLOSED,
        queueCategory: item.queueCategory,
        patientName: item.patientName,
        patientDocument: item.patientDocument,
        prescriptionBarcode: item.prescriptionBarcode,
        preferentialReason: item.preferentialReason,
        cubicleId,
        createdBy: defaultCreatorId,
        assignedAt: calledAt,
        calledAt,
        serviceStartedAt,
        closedAt,
        terminalReason: item.terminalReason,
        createdAt,
      },
    });

    if (cubicleId) {
      await prisma.dispensationRecord.upsert({
        where: { ticketId: ticket.id },
        update: {
          resolution: item.dispensation.resolution,
          prescriptionCode: item.dispensation.prescriptionCode,
          mipresNumber: item.dispensation.mipresNumber,
          itemsDeliveredCount: item.dispensation.itemsDeliveredCount,
          itemsPendingCount: item.dispensation.itemsPendingCount,
          pendingDetailsJson: item.dispensation.pendingDetailsJson,
          deliveryAddress: item.dispensation.deliveryAddress,
          deliveryPhone: item.dispensation.deliveryPhone,
          deliveryDeadline: item.dispensation.deliveryDeadline,
          cubicleId,
          operatorUserId,
        },
        create: {
          id: ulid(),
          ticketId: ticket.id,
          cubicleId,
          operatorUserId,
          resolution: item.dispensation.resolution,
          prescriptionCode: item.dispensation.prescriptionCode,
          mipresNumber: item.dispensation.mipresNumber,
          itemsDeliveredCount: item.dispensation.itemsDeliveredCount,
          itemsPendingCount: item.dispensation.itemsPendingCount,
          pendingDetailsJson: item.dispensation.pendingDetailsJson,
          deliveryAddress: item.dispensation.deliveryAddress,
          deliveryPhone: item.dispensation.deliveryPhone,
          deliveryDeadline: item.dispensation.deliveryDeadline,
          createdAt: closedAt,
        },
      });

      await prisma.ticketCall.upsert({
        where: {
          ticketId_callNumber: {
            ticketId: ticket.id,
            callNumber: 1,
          },
        },
        update: {
          cubicleId,
          calledBy: operatorUserId,
          createdAt: calledAt,
        },
        create: {
          id: ulid(),
          ticketId: ticket.id,
          cubicleId,
          calledBy: operatorUserId,
          callNumber: 1,
          createdAt: calledAt,
        },
      });
    }
  }
  console.log('✅ 4 Turnos cerrados con registro de dispensación (1 PENDING_48H, 3 TOTAL_DELIVERED)');

  // 4. Muestra inicial de turnos en espera (PENDING en distintas categorías)
  const pendingTicketsData = [
    {
      sequenceNumber: 5n,
      publicCode: 'TUR-000005-ES',
      queueCategory: QueueCategory.HIGH_COST,
      patientName: 'Gloria Patricia Arango',
      patientDocument: '43567890',
      prescriptionBarcode: 'RX-MIPRES-8821',
      preferentialReason: null,
      createdOffsetMinutes: 25,
    },
    {
      sequenceNumber: 6n,
      publicCode: 'TUR-000006-PR',
      queueCategory: QueueCategory.PREFERENTIAL,
      patientName: 'Luis Alfonso Betancur',
      patientDocument: '15345678',
      prescriptionBarcode: 'RX-2026-00201',
      preferentialReason: 'SIAU_MOVILIDAD_REDUCIDA',
      createdOffsetMinutes: 18,
    },
    {
      sequenceNumber: 7n,
      publicCode: 'TUR-000007-GE',
      queueCategory: QueueCategory.GENERAL,
      patientName: 'Jorge Eduardo Londoño',
      patientDocument: '98765432',
      prescriptionBarcode: 'RX-2026-00202',
      preferentialReason: null,
      createdOffsetMinutes: 12,
    },
    {
      sequenceNumber: 8n,
      publicCode: 'TUR-000008-FA',
      queueCategory: QueueCategory.BILLING,
      patientName: 'Marcela Ríos Osorio',
      patientDocument: '1017123987',
      prescriptionBarcode: 'RX-2026-00203',
      preferentialReason: null,
      createdOffsetMinutes: 8,
    },
  ];

  for (const item of pendingTicketsData) {
    const createdAt = new Date(now.getTime() - item.createdOffsetMinutes * 60 * 1000);
    await prisma.ticket.upsert({
      where: { publicCode: item.publicCode },
      update: {
        status: TicketStatus.PENDING,
        queueCategory: item.queueCategory,
        patientName: item.patientName,
        patientDocument: item.patientDocument,
        prescriptionBarcode: item.prescriptionBarcode,
        preferentialReason: item.preferentialReason,
        cubicleId: null,
        calledAt: null,
        serviceStartedAt: null,
        closedAt: null,
      },
      create: {
        id: ulid(),
        publicId: ulid(),
        sequenceNumber: item.sequenceNumber,
        publicCode: item.publicCode,
        status: TicketStatus.PENDING,
        queueCategory: item.queueCategory,
        patientName: item.patientName,
        patientDocument: item.patientDocument,
        prescriptionBarcode: item.prescriptionBarcode,
        preferentialReason: item.preferentialReason,
        cubicleId: null,
        createdBy: defaultCreatorId,
        createdAt,
      },
    });
  }
  console.log('✅ 4 Turnos en espera asegurados (HIGH_COST, PREFERENTIAL, GENERAL, BILLING)');

  // 5. Secuencia del sistema sincronizada
  await prisma.systemSequence.upsert({
    where: { sequenceName: 'ticket_public_sequence' },
    update: { nextValue: 9n },
    create: { sequenceName: 'ticket_public_sequence', nextValue: 9n },
  });
  console.log('✅ Secuencia de turnos ajustada a nextValue = 9');
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
