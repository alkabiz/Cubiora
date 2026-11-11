import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  PrismaClient,
  QueueCategory,
  CubicleStatus,
  TicketStatus,
  DispensationResolution,
  UserRole,
  FacilityStatus,
  PharmacistOperationalRole,
  WorkShift,
  PharmacistStatus,
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

// 1. Salvaguarda crítica: jamás ejecutar seed en producción salvo bandera explícita
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
  console.error('❌ ERROR FATAL: El seed de datos de prueba está estrictamente prohibido en NODE_ENV=production.');
  process.exit(1);
}

// 2. Validación de cadena de conexión requerida
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ ERROR CONFIGURACIÓN: DIRECT_URL o DATABASE_URL es obligatoria para ejecutar el seed.');
  process.exit(1);
}

// 3. Guarda de host local: prohibida cualquier IP o dominio externo (salvo red interna configurada)
try {
  const parsedUrl = new URL(connectionString);
  const host = parsedUrl.hostname.toLowerCase();
  const allowedHosts = ['localhost', '127.0.0.1', '::1', '192.168.1.33', 'postgres'];
  if (!allowedHosts.includes(host) && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    console.error(
      `❌ ERROR_SEGURIDAD_HOST_NO_LOCAL: El seed solo puede ejecutarse contra localhost, 127.0.0.1, ::1, 192.168.1.33 o postgres. Host detectado: '${host}'. Conexión remota prohibida.`,
    );
    process.exit(1);
  }
} catch {
  console.error('❌ ERROR CONFIGURACIÓN: La cadena de conexión del seed no es una URL válida.');
  process.exit(1);
}

// 4. Exigir contraseña obligatoria por entorno (con fallback a DEFAULT_ADMIN_PASSWORD si está definido)
const devPassword = process.env.DEV_SEED_USER_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD;
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || process.env.DEV_SEED_USER_PASSWORD;
if (!devPassword || devPassword.length < 8 || !adminPassword || adminPassword.length < 8) {
  console.error(
    '❌ ERROR DE SEGURIDAD: La variable DEV_SEED_USER_PASSWORD o DEFAULT_ADMIN_PASSWORD es obligatoria en el entorno (mínimo 8 caracteres) para crear usuarios.',
  );
  process.exit(1);
}

// 5. Configurar TLS compatible con certificado autofirmado en red interna Docker / LXC (ALLOW_DOCKER_INTERNAL_DB=true)
const isDockerInternal = process.env.ALLOW_DOCKER_INTERNAL_DB === 'true';
const lowerConn = connectionString.toLowerCase();
const sslDisabled = lowerConn.includes('sslmode=disable');
const urlRequestsSsl =
  lowerConn.includes('sslmode=require') ||
  lowerConn.includes('sslmode=verify-ca') ||
  lowerConn.includes('sslmode=verify-full');

let caCert: string | undefined;
const caCertPath = process.env.DATABASE_CA_CERT_PATH || path.resolve(process.cwd(), 'ca-cert.crt');
const caCertPathAlt = path.resolve(process.cwd(), 'apps/api/ca-cert.crt');
const caCertPathSeed = path.resolve(__dirname, '../ca-cert.crt');
if (fs.existsSync(caCertPath)) {
  caCert = fs.readFileSync(caCertPath, 'utf8');
} else if (fs.existsSync(caCertPathAlt)) {
  caCert = fs.readFileSync(caCertPathAlt, 'utf8');
} else if (fs.existsSync(caCertPathSeed)) {
  caCert = fs.readFileSync(caCertPathSeed, 'utf8');
} else if (process.env.DATABASE_CA_CERT) {
  caCert = process.env.DATABASE_CA_CERT;
}

let ssl: { rejectUnauthorized: boolean; ca?: string } | undefined;
if (isDockerInternal) {
  ssl = sslDisabled ? undefined : { rejectUnauthorized: false };
} else if (urlRequestsSsl) {
  if (caCert) {
    ssl = { rejectUnauthorized: true, ca: caCert };
  } else if (lowerConn.includes('sslmode=require')) {
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = { rejectUnauthorized: true };
  }
}

const sanitizedConnectionString = ssl
  ? connectionString.replace(/([?&])sslmode=[^&]+(&|$)/gi, '$1').replace(/[?&]$/, '')
  : connectionString;

const pool = new Pool({ connectionString: sanitizedConnectionString, ssl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de desarrollo para Cubiora (Topología Audifarma PMV)...');

  // 0. Sedes Hospitalarias y Puntos de Dispensación (SCR-ADM-005)
  const existingPrimaryFacility = await prisma.facility.findFirst({
    where: { isPrimary: true },
    select: { id: true, code: true },
  });

  const facilitiesData = [
    {
      code: 'SEDE-CEN-01',
      name: 'Punto de Dispensación Central',
      address: 'Av. Córdoba 2351, Pabellón A (Planta Baja)',
      city: 'CABA',
      phone: '+54 11 4964-8000 (Int. 142)',
      openingHours: '07:00 a 20:00 hs',
      enabledCubiclesCount: 5,
      status: FacilityStatus.ACTIVE,
      isPrimary: true,
    },
    {
      code: 'SEDE-NOR-02',
      name: 'Centro Ambulatorio Norte',
      address: 'Av. Libertador 6420',
      city: 'CABA',
      phone: '+54 11 4789-3100',
      openingHours: '07:30 a 19:00 hs',
      enabledCubiclesCount: 3,
      status: FacilityStatus.ACTIVE,
      isPrimary: false,
    },
    {
      code: 'SEDE-SUR-03',
      name: 'Guardia y Dispensación Sur',
      address: 'Av. Pavón 1890',
      city: 'Avellaneda',
      phone: '+54 11 4208-7500',
      openingHours: '00:00 a 24:00 hs',
      enabledCubiclesCount: 4,
      status: FacilityStatus.ACTIVE,
      isPrimary: false,
    },
    {
      code: 'SEDE-OES-04',
      name: 'Anexo Polivalente Oeste',
      address: 'Av. Gaona 3100',
      city: 'Ramos Mejía',
      phone: '+54 11 4658-4210',
      openingHours: '08:00 a 18:00 hs',
      enabledCubiclesCount: 2,
      status: FacilityStatus.MAINTENANCE,
      isPrimary: false,
    },
  ];

  const facilityIds = new Map<string, string>();
  for (const facility of facilitiesData) {
    const resolvedPrimary = existingPrimaryFacility
      ? existingPrimaryFacility.code === facility.code
      : facility.isPrimary;

    const persisted = await prisma.facility.upsert({
      where: { code: facility.code },
      update: {
        name: facility.name,
        address: facility.address,
        city: facility.city,
        phone: facility.phone,
        openingHours: facility.openingHours,
        enabledCubiclesCount: facility.enabledCubiclesCount,
        status: facility.status,
      },
      create: {
        id: ulid(),
        code: facility.code,
        name: facility.name,
        address: facility.address,
        city: facility.city,
        phone: facility.phone,
        openingHours: facility.openingHours,
        enabledCubiclesCount: facility.enabledCubiclesCount,
        status: facility.status,
        isPrimary: resolvedPrimary,
      },
    });
    facilityIds.set(persisted.code, persisted.id);
  }
  console.log('✅ 4 Sedes hospitalarias aseguradas (SEDE-CEN-01 .. SEDE-OES-04)');

  // 1. Cubículos parametrizados (Topología Audifarma PMV + Sedes)
  const centralFacilityId = facilityIds.get('SEDE-CEN-01') ?? null;
  const northFacilityId = facilityIds.get('SEDE-NOR-02') ?? null;
  const southFacilityId = facilityIds.get('SEDE-SUR-03') ?? null;
  const westFacilityId = facilityIds.get('SEDE-OES-04') ?? null;

  const cubiclesData = [
    {
      code: 'CUB-01',
      displayName: 'Cubículo 01',
      operatorName: 'Lic. M. Arismendi',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.PREFERENTIAL, QueueCategory.GENERAL],
      facilityId: centralFacilityId,
    },
    {
      code: 'CUB-02',
      displayName: 'Cubículo 02',
      operatorName: 'Farm. J. Duarte',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.PREFERENTIAL],
      facilityId: centralFacilityId,
    },
    {
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      operatorName: 'Lic. R. Mendoza',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.BILLING],
      facilityId: centralFacilityId,
    },
    {
      code: 'CUB-04',
      displayName: 'Cubículo 04',
      operatorName: 'Farm. S. Quintero',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.HIGH_COST, QueueCategory.PREFERENTIAL],
      facilityId: centralFacilityId,
    },
    {
      code: 'CUB-05',
      displayName: 'Cubículo 05',
      operatorName: null,
      status: CubicleStatus.INACTIVE,
      active: false,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.HIGH_COST],
      facilityId: centralFacilityId,
    },
    // Ventanillas Sede Norte (SEDE-NOR-02)
    {
      code: 'NOR-CUB-01',
      displayName: 'Cubículo 01',
      operatorName: 'Lic. V. Benítez',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.PREFERENTIAL],
      facilityId: northFacilityId,
    },
    {
      code: 'NOR-CUB-02',
      displayName: 'Cubículo 02',
      operatorName: null,
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.BILLING],
      facilityId: northFacilityId,
    },
    {
      code: 'NOR-CUB-03',
      displayName: 'Cubículo 03',
      operatorName: null,
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: northFacilityId,
    },
    // Ventanillas Sede Sur (SEDE-SUR-03)
    {
      code: 'SUR-CUB-01',
      displayName: 'Cubículo 01',
      operatorName: 'Lic. D. Carrizo',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.PREFERENTIAL],
      facilityId: southFacilityId,
    },
    {
      code: 'SUR-CUB-02',
      displayName: 'Cubículo 02',
      operatorName: 'Farm. Auxiliar Guardia',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL, QueueCategory.HIGH_COST],
      facilityId: southFacilityId,
    },
    {
      code: 'SUR-CUB-03',
      displayName: 'Cubículo 03',
      operatorName: null,
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: southFacilityId,
    },
    {
      code: 'SUR-CUB-04',
      displayName: 'Cubículo 04',
      operatorName: null,
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: southFacilityId,
    },
    // Ventanillas Sede Oeste (SEDE-OES-04 — en mantenimiento)
    {
      code: 'OES-CUB-01',
      displayName: 'Cubículo 01',
      operatorName: null,
      status: CubicleStatus.INACTIVE,
      active: false,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: westFacilityId,
    },
    {
      code: 'OES-CUB-02',
      displayName: 'Cubículo 02',
      operatorName: null,
      status: CubicleStatus.INACTIVE,
      active: false,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: westFacilityId,
    },
  ];

  const cubicleIds = new Map<string, string>();
  for (const cubicle of cubiclesData) {
    const persisted = await prisma.cubicle.upsert({
      where: { code: cubicle.code },
      update: {
        displayName: cubicle.displayName,
        operatorName: cubicle.operatorName,
        allowedCategories: cubicle.allowedCategories,
        facilityId: cubicle.facilityId,
      },
      create: {
        id: ulid(),
        code: cubicle.code,
        displayName: cubicle.displayName,
        operatorName: cubicle.operatorName,
        status: cubicle.status,
        active: cubicle.active,
        allowedCategories: cubicle.allowedCategories,
        facilityId: cubicle.facilityId,
      },
    });
    cubicleIds.set(persisted.code, persisted.id);
  }
  console.log('✅ Cubículos asegurados (CUB-01..CUB-05 vinculados a SEDE-CEN-01 y ventanillas de red)');

  // 2. Usuarios de prueba para desarrollo local con publicId e id ULID válidos
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(devPassword, salt);
  const adminPasswordHash =
    adminPassword === devPassword ? passwordHash : await bcrypt.hash(adminPassword, salt);

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
      passwordHash: adminPasswordHash,
    },
    {
      id: ulid(),
      publicId: ulid(),
      username: 'admin_cubiora',
      displayName: 'Administrador del Sistema',
      role: UserRole.ADMIN,
      cubicleId: null,
      passwordHash: adminPasswordHash,
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
        active: true,
        ...(user.role === UserRole.ADMIN ? { passwordHash: user.passwordHash } : {}),
      },
      create: user,
    });
    userIds.set(persisted.username, persisted.id);
  }
  console.log('✅ Usuarios asegurados (incluye admin/admin_cubiora y asignación a cubículos CUB-01..CUB-04)');

  // 2b. Farmacéuticos registrados vinculados a sedes y cubículos (SCR-ADM-004)
  const pharmacistsData = [
    {
      fullName: 'Lic. R. Mendoza',
      licenseNumber: 'MN-4812',
      operationalRole: PharmacistOperationalRole.TITULAR,
      facilityCode: 'SEDE-CEN-01',
      shift: WorkShift.MORNING,
      cubicleCode: 'CUB-03',
      status: PharmacistStatus.ACTIVE,
      dispatchesCount: 142,
      email: 'r.mendoza@cubiora.hospital',
      phone: '+54 11 4964-8103',
      username: 'cajero',
    },
    {
      fullName: 'Lic. M. Arismendi',
      licenseNumber: 'MN-3914',
      operationalRole: PharmacistOperationalRole.TITULAR,
      facilityCode: 'SEDE-CEN-01',
      shift: WorkShift.MORNING,
      cubicleCode: 'CUB-01',
      status: PharmacistStatus.ACTIVE,
      dispatchesCount: 188,
      email: 'm.arismendi@cubiora.hospital',
      phone: '+54 11 4964-8101',
      username: 'cajero1',
    },
    {
      fullName: 'Farm. J. Duarte',
      licenseNumber: 'MP-8921',
      operationalRole: PharmacistOperationalRole.ADJUNTO,
      facilityCode: 'SEDE-CEN-01',
      shift: WorkShift.AFTERNOON,
      cubicleCode: 'CUB-02',
      status: PharmacistStatus.ACTIVE,
      dispatchesCount: 96,
      email: 'j.duarte@cubiora.hospital',
      phone: '+54 11 4964-8102',
      username: 'cajero2',
    },
    {
      fullName: 'Farm. S. Quintero',
      licenseNumber: 'MN-7230',
      operationalRole: PharmacistOperationalRole.DISPENSADOR,
      facilityCode: 'SEDE-CEN-01',
      shift: WorkShift.ROTATING,
      cubicleCode: 'CUB-04',
      status: PharmacistStatus.ACTIVE,
      dispatchesCount: 115,
      email: 's.quintero@cubiora.hospital',
      phone: '+54 11 4964-8104',
      username: 'cajero4',
    },
    {
      fullName: 'Lic. V. Benítez',
      licenseNumber: 'MN-6109',
      operationalRole: PharmacistOperationalRole.TITULAR,
      facilityCode: 'SEDE-NOR-02',
      shift: WorkShift.MORNING,
      cubicleCode: 'NOR-CUB-01',
      status: PharmacistStatus.ACTIVE,
      dispatchesCount: 130,
      email: 'v.benitez@cubiora.hospital',
      phone: '+54 11 4789-3101',
      username: null,
    },
    {
      fullName: 'Farm. C. Paoli',
      licenseNumber: 'MP-5542',
      operationalRole: PharmacistOperationalRole.ADJUNTO,
      facilityCode: 'SEDE-NOR-02',
      shift: WorkShift.AFTERNOON,
      cubicleCode: null,
      status: PharmacistStatus.ON_LEAVE,
      dispatchesCount: 84,
      email: 'c.paoli@cubiora.hospital',
      phone: '+54 11 4789-3102',
      username: null,
    },
    {
      fullName: 'Lic. D. Carrizo',
      licenseNumber: 'MN-9041',
      operationalRole: PharmacistOperationalRole.GUARDIA,
      facilityCode: 'SEDE-SUR-03',
      shift: WorkShift.NIGHT,
      cubicleCode: 'SUR-CUB-01',
      status: PharmacistStatus.ACTIVE,
      dispatchesCount: 162,
      email: 'd.carrizo@cubiora.hospital',
      phone: '+54 11 4208-7501',
      username: null,
    },
    {
      fullName: 'Farm. Auxiliar Guardia',
      licenseNumber: 'MN-0042',
      operationalRole: PharmacistOperationalRole.GUARDIA,
      facilityCode: 'SEDE-SUR-03',
      shift: WorkShift.ROTATING,
      cubicleCode: 'SUR-CUB-02',
      status: PharmacistStatus.ACTIVE,
      dispatchesCount: 90,
      email: 'guardia.aux@cubiora.hospital',
      phone: '+54 11 4208-7502',
      username: null,
    },
  ];

  for (const pharm of pharmacistsData) {
    const facilityId = facilityIds.get(pharm.facilityCode) ?? null;
    const cubicleId = pharm.cubicleCode ? (cubicleIds.get(pharm.cubicleCode) ?? null) : null;
    const userId = pharm.username ? (userIds.get(pharm.username) ?? null) : null;

    await prisma.pharmacist.upsert({
      where: { licenseNumber: pharm.licenseNumber },
      update: {
        fullName: pharm.fullName,
        operationalRole: pharm.operationalRole,
        shift: pharm.shift,
        status: pharm.status,
        email: pharm.email,
        phone: pharm.phone,
        dispatchesCount: pharm.dispatchesCount,
        facilityId,
        cubicleId,
        userId,
      },
      create: {
        id: ulid(),
        fullName: pharm.fullName,
        licenseNumber: pharm.licenseNumber,
        operationalRole: pharm.operationalRole,
        shift: pharm.shift,
        status: pharm.status,
        email: pharm.email,
        phone: pharm.phone,
        dispatchesCount: pharm.dispatchesCount,
        facilityId,
        cubicleId,
        userId,
      },
    });
  }
  console.log('✅ 8 Farmacéuticos registrados asegurados y sincronizados con sedes y cubículos');

  const defaultCreatorId =
    userIds.get('recepcion') ??
    userIds.get('receptor') ??
    userIds.get('admin') ??
    userIds.get('admin_cubiora')!;
  const now = new Date();

  const existingTicketsCount = await prisma.ticket.count();
  if (existingTicketsCount > 0) {
    console.log(
      `ℹ️  Ya existen ${existingTicketsCount} turnos en la base de datos; se omite la creación de turnos de demostración para evitar colisión de sequence_number.`,
    );
  } else {
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
  }

  // 5. Secuencia del sistema sincronizada sin retroceder el valor máximo actual
  const ticketSeqAgg = await prisma.ticket.aggregate({
    _max: { sequenceNumber: true },
  });
  const maxSequence = ticketSeqAgg._max.sequenceNumber ?? 0n;
  const minimumNextValue = maxSequence + 1n;

  for (const sequenceName of ['TICKETS', 'ticket_public_sequence'] as const) {
    const existingSeq = await prisma.systemSequence.findUnique({
      where: { sequenceName },
      select: { nextValue: true },
    });
    const nextValue =
      existingSeq && existingSeq.nextValue > minimumNextValue
        ? existingSeq.nextValue
        : minimumNextValue;

    await prisma.systemSequence.upsert({
      where: { sequenceName },
      update: { nextValue },
      create: { sequenceName, nextValue },
    });
  }
  console.log(`✅ Secuencias sincronizadas (TICKETS / ticket_public_sequence >= ${minimumNextValue})`);
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
