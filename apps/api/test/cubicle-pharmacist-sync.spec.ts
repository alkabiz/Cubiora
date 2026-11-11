import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CubicleStatus, PharmacistStatus, QueueCategory, UserRole } from '@cubiora/shared';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CubiclesModule } from '../src/modules/cubicles/cubicles.module';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { AdminCubiclesController } from '../src/modules/cubicles/admin-cubicles.controller';
import { OperationalTelemetryModule } from '../src/modules/operational-telemetry/operational-telemetry.module';
import { OperationalTelemetryService } from '../src/modules/operational-telemetry/operational-telemetry.service';
import { PharmacistsModule } from '../src/modules/pharmacists/pharmacists.module';
import { FacilitiesModule } from '../src/modules/facilities/facilities.module';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersService } from '../src/modules/users/users.service';

describe('[SCR-ADM-002 <-> 004 <-> 005] Sincronización de Cubículos con Farmacéuticos y Sedes', () => {
  let mockPrisma: any;
  let mockTelemetry: any;
  let service: CubiclesService;

  beforeEach(() => {
    mockTelemetry = {
      emitCubicleUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const txClient = {
      pharmacist: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: 'ph-3' }),
      },
      cubicle: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cub-01', facilityId: 'fac-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: 'cub-01', operatorName: 'Lic. R. Mendoza' }),
      },
    };

    mockPrisma = {
      __tx: txClient,
      facility: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'fac-1',
          code: 'SEDE-CEN-01',
          name: 'Punto de Dispensación Central',
          isPrimary: true,
        }),
        findUnique: vi.fn(),
      },
      cubicle: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      pharmacist: txClient.pharmacist,
      ticket: {
        findMany: vi.fn().mockResolvedValue([{ cubicleId: 'cub-01' }, { cubicleId: 'cub-01' }]),
        findFirst: vi.fn(),
        count: vi.fn().mockResolvedValue(2),
      },
      $transaction: vi.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient)),
    };

    service = new CubiclesService(mockPrisma, mockTelemetry);
  });

  it('compila CubiclesModule + OperationalTelemetryModule + PharmacistsModule + FacilitiesModule + UsersModule en Nest DI sin errores circulares', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PrismaModule,
        CubiclesModule,
        OperationalTelemetryModule,
        PharmacistsModule,
        FacilitiesModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    const cubiclesService = moduleRef.get(CubiclesService);
    const telemetryService = moduleRef.get(OperationalTelemetryService);
    const adminCtrl = moduleRef.get(AdminCubiclesController);
    const usersService = moduleRef.get(UsersService);
    expect(cubiclesService).toBeDefined();
    expect(telemetryService).toBeDefined();
    expect(adminCtrl).toBeDefined();
    expect(usersService).toBeDefined();
    expect(
      (cubiclesService as unknown as { telemetryService?: OperationalTelemetryService })
        .telemetryService,
    ).toBeInstanceOf(OperationalTelemetryService);
    expect(
      (telemetryService as unknown as { cubiclesService?: CubiclesService }).cubiclesService,
    ).toBeInstanceOf(CubiclesService);
    expect(
      (usersService as unknown as { telemetryService?: OperationalTelemetryService })
        .telemetryService,
    ).toBeInstanceOf(OperationalTelemetryService);

    await moduleRef.close();
  });

  it('getAdminCubicles lista cubículos de la sede primaria con farmacéutico asignado y conteo diario', async () => {
    mockPrisma.cubicle.findMany.mockResolvedValueOnce([
      {
        id: 'cub-01',
        code: 'CUB-01',
        displayName: 'Cubículo 01',
        operatorName: 'Lic. M. Arismendi',
        status: CubicleStatus.AVAILABLE,
        active: true,
        allowedCategories: [QueueCategory.GENERAL],
        facilityId: 'fac-1',
        facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Punto de Dispensación Central' },
        pharmacists: [
          {
            id: 'ph-1',
            fullName: 'Lic. M. Arismendi',
            licenseNumber: 'MN-3914',
            status: PharmacistStatus.ACTIVE,
          },
        ],
        version: 2,
      },
    ]);

    const list = await service.getAdminCubicles();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      code: 'CUB-01',
      pharmacistId: 'ph-1',
      pharmacistName: 'Lic. M. Arismendi',
      pharmacistLicenseNumber: 'MN-3914',
      dailyCompletedCount: 2,
      facilityCode: 'SEDE-CEN-01',
    });
  });

  it('assignPharmacistToCubicle sincroniza bidireccionalmente y emite eventos de telemetría', async () => {
    mockPrisma.cubicle.findFirst.mockResolvedValueOnce({ id: 'cub-01' });
    mockPrisma.cubicle.findUnique
      .mockResolvedValueOnce({ id: 'cub-01' })
      .mockResolvedValueOnce({
        id: 'cub-01',
        code: 'CUB-01',
        displayName: 'Cubículo 01',
        operatorName: 'Lic. R. Mendoza',
        status: CubicleStatus.AVAILABLE,
        active: true,
        allowedCategories: [QueueCategory.GENERAL],
        facilityId: 'fac-1',
        facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Central' },
        pharmacists: [
          {
            id: 'ph-3',
            fullName: 'Lic. R. Mendoza',
            licenseNumber: 'MN-4812',
            status: PharmacistStatus.ACTIVE,
          },
        ],
        version: 3,
      });

    mockPrisma.__tx.pharmacist.findUnique.mockResolvedValueOnce({
      id: 'ph-3',
      fullName: 'Lic. R. Mendoza',
      facilityId: 'fac-1',
      cubicleId: 'cub-03',
      status: PharmacistStatus.ACTIVE,
    });

    const updated = await service.assignPharmacistToCubicle('CUB-01', 'ph-3');

    expect(updated.pharmacistId).toBe('ph-3');
    expect(updated.operatorName).toBe('Lic. R. Mendoza');
    expect(mockPrisma.__tx.cubicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'cub-03', operatorName: 'Lic. R. Mendoza' },
      data: { operatorName: null, version: { increment: 1 } },
    });
    expect(mockTelemetry.emitCubicleUpdate).toHaveBeenCalledWith('cub-03');
    expect(mockTelemetry.emitCubicleUpdate).toHaveBeenCalledWith('cub-01');
    expect(mockTelemetry.broadcastSnapshot).toHaveBeenCalled();
  });

  it('updateAdminCubicleStatus rechaza desactivar si hay turno activo (409) y permite cuando está libre', async () => {
    mockPrisma.cubicle.findFirst.mockResolvedValueOnce({ id: 'cub-01', status: CubicleStatus.BUSY });
    mockPrisma.ticket.findFirst.mockResolvedValueOnce({ publicCode: 'TUR-000122-F4' });

    await expect(service.updateAdminCubicleStatus('cub-01', false)).rejects.toThrow(
      ConflictException,
    );

    mockPrisma.cubicle.findFirst.mockResolvedValueOnce({
      id: 'cub-01',
      status: CubicleStatus.AVAILABLE,
    });
    mockPrisma.ticket.findFirst.mockResolvedValueOnce(null);
    mockPrisma.cubicle.update.mockResolvedValueOnce({ id: 'cub-01', active: false });
    mockPrisma.cubicle.findUnique.mockResolvedValueOnce({
      id: 'cub-01',
      code: 'CUB-01',
      displayName: 'Cubículo 01',
      operatorName: null,
      status: CubicleStatus.INACTIVE,
      active: false,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: 'fac-1',
      facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Central' },
      pharmacists: [],
      version: 2,
    });

    const toggled = await service.updateAdminCubicleStatus('cub-01', false);
    expect(toggled.active).toBe(false);
    expect(toggled.status).toBe(CubicleStatus.INACTIVE);
    expect(mockTelemetry.emitCubicleUpdate).toHaveBeenCalledWith('cub-01');
  });

  it('AdminCubiclesController exige @Roles(UserRole.ADMIN) en todos sus endpoints', () => {
    const methods: Array<keyof AdminCubiclesController> = [
      'listAdminCubicles',
      'assignPharmacist',
      'updateCubicleStatus',
    ];
    for (const method of methods) {
      const roles = Reflect.getMetadata('roles', AdminCubiclesController.prototype[method]);
      expect(roles).toEqual([UserRole.ADMIN]);
    }
  });

  it('assignPharmacistToCubicle sincroniza User.cubicleId en asignación y desvinculación 1:1:1 y deriva operatorName desde 3FN', async () => {
    mockPrisma.__tx.user = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };

    mockPrisma.cubicle.findFirst.mockResolvedValueOnce({ id: 'cub-01' });
    mockPrisma.cubicle.findUnique
      .mockResolvedValueOnce({ id: 'cub-01' })
      .mockResolvedValueOnce({
        id: 'cub-01',
        code: 'CUB-01',
        displayName: 'Cubículo 01',
        operatorName: 'Obsoleto',
        status: CubicleStatus.AVAILABLE,
        active: true,
        allowedCategories: [QueueCategory.GENERAL],
        facilityId: 'fac-1',
        facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Central' },
        currentOperator: { displayName: 'Cajero', role: UserRole.CASHIER, active: true },
        pharmacists: [
          {
            id: 'ph-3',
            fullName: 'Lic. R. Mendoza',
            licenseNumber: 'MN-4812',
            status: PharmacistStatus.ACTIVE,
          },
        ],
        version: 4,
      });

    mockPrisma.__tx.pharmacist.findUnique.mockResolvedValueOnce({
      id: 'ph-3',
      userId: 'usr-3',
      fullName: 'Lic. R. Mendoza',
      facilityId: 'fac-1',
      cubicleId: 'cub-03',
      status: PharmacistStatus.ACTIVE,
    });

    const assigned = await service.assignPharmacistToCubicle('CUB-01', 'ph-3');

    expect(assigned.operatorName).toBe('Lic. R. Mendoza');
    expect(mockPrisma.__tx.user.updateMany).toHaveBeenCalledWith({
      where: { cubicleId: 'cub-01', id: { not: 'usr-3' } },
      data: { cubicleId: null },
    });
    expect(mockPrisma.__tx.user.updateMany).toHaveBeenCalledWith({
      where: { cubicleId: 'cub-03', id: 'usr-3' },
      data: { cubicleId: null },
    });
    expect(mockPrisma.__tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'usr-3' },
      data: { cubicleId: 'cub-01' },
    });

    // Ahora desvincular explícitamente
    mockPrisma.cubicle.findFirst.mockResolvedValueOnce({ id: 'cub-01' });
    mockPrisma.cubicle.findUnique
      .mockResolvedValueOnce({ id: 'cub-01' })
      .mockResolvedValueOnce({
        id: 'cub-01',
        code: 'CUB-01',
        displayName: 'Cubículo 01',
        operatorName: null,
        status: CubicleStatus.AVAILABLE,
        active: true,
        allowedCategories: [QueueCategory.GENERAL],
        facilityId: 'fac-1',
        facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Central' },
        currentOperator: null,
        pharmacists: [],
        version: 5,
      });

    await service.assignPharmacistToCubicle('CUB-01', null);
    expect(mockPrisma.__tx.user.updateMany).toHaveBeenCalledWith({
      where: { cubicleId: 'cub-01' },
      data: { cubicleId: null },
    });
  });

  it('updateAdminCubicleStatus sincroniza facility.enabledCubiclesCount dentro de la transacción', async () => {
    mockPrisma.__tx.cubicle.count = vi.fn().mockResolvedValue(3);
    mockPrisma.__tx.facility = {
      update: vi.fn().mockResolvedValue({ id: 'fac-1', enabledCubiclesCount: 3 }),
    };
    mockPrisma.cubicle.count = mockPrisma.__tx.cubicle.count;
    mockPrisma.facility.update = mockPrisma.__tx.facility.update;

    mockPrisma.cubicle.findFirst.mockResolvedValueOnce({
      id: 'cub-04',
      status: CubicleStatus.AVAILABLE,
      facilityId: 'fac-1',
    });
    mockPrisma.ticket.findFirst.mockResolvedValueOnce(null);
    mockPrisma.cubicle.findUnique.mockResolvedValueOnce({
      id: 'cub-04',
      code: 'CUB-04',
      displayName: 'Cubículo 04',
      operatorName: null,
      status: CubicleStatus.INACTIVE,
      active: false,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: 'fac-1',
      facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Central' },
      currentOperator: null,
      pharmacists: [],
      version: 3,
    });

    await service.updateAdminCubicleStatus('cub-04', false);
    expect(mockPrisma.__tx.cubicle.count).toHaveBeenCalledWith({
      where: { facilityId: 'fac-1', active: true },
    });
    expect(mockPrisma.__tx.facility.update).toHaveBeenCalledWith({
      where: { id: 'fac-1' },
      data: { enabledCubiclesCount: 3 },
    });
  });
});
