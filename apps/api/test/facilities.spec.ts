import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CubicleStatus,
  FacilityStatus,
  PharmacistOperationalRole,
  PharmacistStatus,
  UserRole,
  WorkShift,
} from '@cubiora/shared';
import { FacilitiesService } from '../src/modules/facilities/facilities.service';
import { FacilitiesController } from '../src/modules/facilities/facilities.controller';
import { CreateFacilityDto } from '../src/modules/facilities/dto/create-facility.dto';
import { AssignPharmacistToFacilityDto } from '../src/modules/facilities/dto/assign-pharmacist-to-facility.dto';

describe('[SCR-ADM-005] FacilitiesModule – Sedes, Activación Primaria y Asignación', () => {
  let mockPrisma: any;
  let mockTelemetry: any;
  let service: FacilitiesService;

  beforeEach(() => {
    mockTelemetry = {
      emitCubicleUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const txClient = {
      facility: {
        create: vi.fn().mockResolvedValue({ id: 'fac-new' }),
        update: vi.fn().mockResolvedValue({ id: 'fac-2' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        delete: vi.fn().mockResolvedValue({ id: 'fac-2' }),
      },
      cubicle: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'cub-new' }),
        update: vi.fn().mockResolvedValue({ id: 'cub-new' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        delete: vi.fn().mockResolvedValue({ id: 'cub-unused' }),
      },
      pharmacist: {
        update: vi.fn().mockResolvedValue({ id: 'ph-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockPrisma = {
      __tx: txClient,
      facility: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      cubicle: {
        findUnique: vi.fn(),
      },
      pharmacist: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient)),
    };

    service = new FacilitiesService(mockPrisma, mockTelemetry);
  });

  it('valida CreateFacilityDto y AssignPharmacistToFacilityDto correctamente', async () => {
    const facDto = plainToInstance(CreateFacilityDto, {
      code: ' sede-norte-05 ',
      name: '  Anexo Norte  ',
      address: 'Av. Libertador 1200',
      city: 'CABA',
      enabledCubiclesCount: 3,
      status: FacilityStatus.ACTIVE,
    });
    expect(await validate(facDto)).toHaveLength(0);
    expect(facDto.code).toBe('SEDE-NORTE-05');
    expect(facDto.name).toBe('Anexo Norte');

    const assignDto = plainToInstance(AssignPharmacistToFacilityDto, {
      pharmacistId: '01JTESTPHARMACIST0000001',
      cubicleId: '',
    });
    expect(await validate(assignDto)).toHaveLength(0);
    expect(assignDto.cubicleId).toBeNull();
  });

  it('create rechaza código duplicado (409) y aprovisiona cubículos automáticos', async () => {
    mockPrisma.facility.findUnique.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.create({
        code: 'SEDE-CEN-01',
        name: 'Duplicada',
        address: 'Calle 1',
        city: 'CABA',
      }),
    ).rejects.toThrow(ConflictException);

    mockPrisma.facility.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'fac-new',
        code: 'SEDE-EST-05',
        name: 'Policlínico Este',
        address: 'Av. Este 900',
        city: 'CABA',
        phone: '+54 11 5555-0000',
        openingHours: '07:00 a 19:00 hs',
        enabledCubiclesCount: 2,
        status: FacilityStatus.ACTIVE,
        isPrimary: false,
        cubicles: [
          {
            id: 'c1',
            code: 'EST05-CUB-01',
            displayName: 'Cubículo 01',
            status: CubicleStatus.AVAILABLE,
            active: true,
            operatorName: null,
            pharmacists: [],
          },
          {
            id: 'c2',
            code: 'EST05-CUB-02',
            displayName: 'Cubículo 02',
            status: CubicleStatus.AVAILABLE,
            active: true,
            operatorName: null,
            pharmacists: [],
          },
        ],
        pharmacists: [],
      });

    const created = await service.create({
      code: 'SEDE-EST-05',
      name: 'Policlínico Este',
      address: 'Av. Este 900',
      city: 'CABA',
      enabledCubiclesCount: 2,
      phone: '+54 11 5555-0000',
      openingHours: '07:00 a 19:00 hs',
    });

    expect(mockPrisma.__tx.cubicle.create).toHaveBeenCalledTimes(2);
    expect(created.cubicles).toHaveLength(2);
    expect(created.cubicles[0]?.shortCode).toBe('C01');
  });

  it('activate marca isPrimary en transacción y fuerza broadcast de telemetría', async () => {
    mockPrisma.facility.findUnique.mockResolvedValueOnce({
      id: 'fac-inactive',
      code: 'SEDE-OES-04',
      status: FacilityStatus.INACTIVE,
    });

    await expect(service.activate('fac-inactive')).rejects.toThrow(ConflictException);

    mockPrisma.facility.findUnique
      .mockResolvedValueOnce({
        id: 'fac-2',
        code: 'SEDE-NOR-02',
        status: FacilityStatus.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: 'fac-2',
        code: 'SEDE-NOR-02',
        name: 'Centro Ambulatorio Norte',
        address: 'Av. Libertador 6420',
        city: 'CABA',
        phone: '123',
        openingHours: '07:00 a 19:00 hs',
        enabledCubiclesCount: 3,
        status: FacilityStatus.ACTIVE,
        isPrimary: true,
        cubicles: [],
        pharmacists: [],
      });

    const activated = await service.activate('fac-2');

    expect(activated.isPrimary).toBe(true);
    expect(mockPrisma.__tx.facility.updateMany).toHaveBeenCalledWith({
      where: { id: { not: 'fac-2' } },
      data: { isPrimary: false },
    });
    expect(mockPrisma.__tx.facility.update).toHaveBeenCalledWith({
      where: { id: 'fac-2' },
      data: { isPrimary: true },
    });
    expect(mockTelemetry.broadcastSnapshot).toHaveBeenCalled();
  });

  it('assignPharmacist asocia profesional y sincroniza operador en cubículo', async () => {
    mockPrisma.facility.findUnique
      .mockResolvedValueOnce({ id: 'fac-2', code: 'SEDE-NOR-02' })
      .mockResolvedValueOnce({
        id: 'fac-2',
        code: 'SEDE-NOR-02',
        name: 'Centro Ambulatorio Norte',
        address: 'Av. Libertador 6420',
        city: 'CABA',
        phone: '123',
        openingHours: '07:00 a 19:00 hs',
        enabledCubiclesCount: 3,
        status: FacilityStatus.ACTIVE,
        isPrimary: false,
        cubicles: [],
        pharmacists: [
          {
            id: 'ph-1',
            fullName: 'Lic. R. Mendoza',
            licenseNumber: 'MN-4812',
            operationalRole: PharmacistOperationalRole.TITULAR,
            shift: WorkShift.MORNING,
            status: PharmacistStatus.ACTIVE,
            cubicleId: 'cub-nor-1',
            cubicle: { id: 'cub-nor-1', displayName: 'Cubículo 01' },
          },
        ],
      });

    mockPrisma.pharmacist.findUnique.mockResolvedValueOnce({
      id: 'ph-1',
      fullName: 'Lic. R. Mendoza',
      status: PharmacistStatus.ACTIVE,
      cubicleId: 'cub-cen-3',
    });
    mockPrisma.cubicle.findUnique.mockResolvedValueOnce({
      id: 'cub-nor-1',
      facilityId: 'fac-2',
    });

    const result = await service.assignPharmacist('fac-2', {
      pharmacistId: 'ph-1',
      cubicleId: 'cub-nor-1',
    });

    expect(mockPrisma.__tx.cubicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'cub-cen-3', operatorName: 'Lic. R. Mendoza' },
      data: { operatorName: null, version: { increment: 1 } },
    });
    expect(mockPrisma.__tx.cubicle.update).toHaveBeenCalledWith({
      where: { id: 'cub-nor-1' },
      data: { operatorName: 'Lic. R. Mendoza', version: { increment: 1 } },
    });
    expect(mockTelemetry.emitCubicleUpdate).toHaveBeenCalledWith('cub-cen-3');
    expect(mockTelemetry.emitCubicleUpdate).toHaveBeenCalledWith('cub-nor-1');
    expect(result.pharmacistsCount).toBe(1);
  });

  it('remove impide eliminar sede primaria y preserva cubículos con historial', async () => {
    mockPrisma.facility.findUnique.mockResolvedValueOnce({
      id: 'fac-primary',
      code: 'SEDE-CEN-01',
      isPrimary: true,
      cubicles: [],
    });

    await expect(service.remove('fac-primary')).rejects.toThrow(ConflictException);

    mockPrisma.facility.findUnique.mockResolvedValueOnce({
      id: 'fac-sec',
      code: 'SEDE-OES-04',
      isPrimary: false,
      cubicles: [
        {
          id: 'cub-hist',
          _count: { tickets: 2, calls: 0, statusHistory: 0, dispensations: 0 },
        },
        {
          id: 'cub-clean',
          _count: { tickets: 0, calls: 0, statusHistory: 0, dispensations: 0 },
        },
      ],
    });

    const deleted = await service.remove('fac-sec');
    expect(deleted).toEqual({ deleted: true, id: 'fac-sec' });
    expect(mockPrisma.__tx.cubicle.update).toHaveBeenCalledWith({
      where: { id: 'cub-hist' },
      data: {
        facilityId: null,
        operatorName: null,
        active: false,
        status: CubicleStatus.INACTIVE,
      },
    });
    expect(mockPrisma.__tx.cubicle.delete).toHaveBeenCalledWith({ where: { id: 'cub-clean' } });
  });

  it('FacilitiesController protege todos sus endpoints con @Roles(UserRole.ADMIN)', () => {
    const methods: Array<keyof FacilitiesController> = [
      'findAll',
      'create',
      'update',
      'activate',
      'assignPharmacist',
      'remove',
    ];
    for (const method of methods) {
      const roles = Reflect.getMetadata('roles', FacilitiesController.prototype[method]);
      expect(roles).toEqual([UserRole.ADMIN]);
    }
  });

  it('findAll deriva enabledCubiclesCount real desde cubículos activos y operatorName desde relación 3FN', async () => {
    mockPrisma.facility.findMany.mockResolvedValueOnce([
      {
        id: 'fac-1',
        code: 'SEDE-CEN-01',
        name: 'Central',
        address: 'Calle 1',
        city: 'Bogotá',
        phone: '123',
        openingHours: '07:00 a 19:00',
        enabledCubiclesCount: 99,
        status: FacilityStatus.ACTIVE,
        isPrimary: true,
        cubicles: [
          {
            id: 'c1',
            code: 'CUB-01',
            displayName: 'Cubículo 01',
            status: CubicleStatus.AVAILABLE,
            active: true,
            operatorName: 'Legacy',
            currentOperator: null,
            pharmacists: [{ id: 'ph-1', fullName: 'Lic. M. Arismendi', status: PharmacistStatus.ACTIVE }],
          },
          {
            id: 'c2',
            code: 'CUB-02',
            displayName: 'Cubículo 02',
            status: CubicleStatus.INACTIVE,
            active: false,
            operatorName: null,
            currentOperator: null,
            pharmacists: [],
          },
        ],
        pharmacists: [],
      },
    ]);

    const list = await service.findAll();
    expect(list[0]?.enabledCubiclesCount).toBe(1);
    expect(list[0]?.cubiclesCount).toBe(2);
    expect(list[0]?.cubicles[0]?.operatorName).toBe('Lic. M. Arismendi');
  });

  it('update sincroniza enabledCubiclesCount real, assignPharmacist enlaza User.cubicleId y remove bloquea sedes con tickets', async () => {
    mockPrisma.__tx.cubicle.count = vi.fn().mockResolvedValue(2);
    mockPrisma.facility.findUnique
      .mockResolvedValueOnce({
        id: 'fac-2',
        code: 'SEDE-NOR-02',
        status: FacilityStatus.ACTIVE,
        enabledCubiclesCount: 3,
        isPrimary: false,
        cubicles: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      })
      .mockResolvedValueOnce({
        id: 'fac-2',
        code: 'SEDE-NOR-02',
        name: 'Norte',
        address: 'Av 1',
        city: 'Bogotá',
        phone: '1',
        openingHours: '07:00 a 19:00',
        enabledCubiclesCount: 2,
        status: FacilityStatus.ACTIVE,
        isPrimary: false,
        cubicles: [],
        pharmacists: [],
      });

    await service.update('fac-2', { enabledCubiclesCount: 2 });
    expect(mockPrisma.__tx.facility.update).toHaveBeenCalledWith({
      where: { id: 'fac-2' },
      data: { enabledCubiclesCount: 2 },
    });

    // assignPharmacist sincroniza también User.cubicleId
    mockPrisma.__tx.user = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    mockPrisma.facility.findUnique
      .mockResolvedValueOnce({ id: 'fac-2', code: 'SEDE-NOR-02' })
      .mockResolvedValueOnce({
        id: 'fac-2',
        code: 'SEDE-NOR-02',
        name: 'Norte',
        address: 'Av 1',
        city: 'Bogotá',
        phone: '1',
        openingHours: '07:00 a 19:00',
        enabledCubiclesCount: 2,
        status: FacilityStatus.ACTIVE,
        isPrimary: false,
        cubicles: [],
        pharmacists: [],
      });
    mockPrisma.pharmacist.findUnique.mockResolvedValueOnce({
      id: 'ph-9',
      userId: 'usr-9',
      fullName: 'Farm. Prueba',
      status: PharmacistStatus.ACTIVE,
      cubicleId: 'c-old',
    });
    mockPrisma.cubicle.findUnique.mockResolvedValueOnce({ id: 'c-new', facilityId: 'fac-2' });

    await service.assignPharmacist('fac-2', { pharmacistId: 'ph-9', cubicleId: 'c-new' });
    expect(mockPrisma.__tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'usr-9' },
      data: { cubicleId: 'c-new' },
    });

    // remove rechaza sede con tickets históricos (FK RESTRICT)
    mockPrisma.facility.findUnique.mockResolvedValueOnce({
      id: 'fac-with-tickets',
      code: 'SEDE-NOR-02',
      isPrimary: false,
      _count: { tickets: 5 },
      cubicles: [],
    });
    await expect(service.remove('fac-with-tickets')).rejects.toThrow(ConflictException);
  });

  it('impide crear o actualizar una sede INACTIVE como isPrimary: true (409 Conflict)', async () => {
    mockPrisma.facility.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.create({
        code: 'SEDE-INACT-99',
        name: 'Sede Inactiva Primaria',
        address: 'Calle 99',
        city: 'Bogotá',
        status: FacilityStatus.INACTIVE,
        isPrimary: true,
      }),
    ).rejects.toThrow(ConflictException);

    mockPrisma.facility.findUnique.mockResolvedValueOnce({
      id: 'fac-inact',
      code: 'SEDE-OES-04',
      status: FacilityStatus.INACTIVE,
      isPrimary: false,
      enabledCubiclesCount: 0,
      cubicles: [],
    });
    await expect(service.update('fac-inact', { isPrimary: true })).rejects.toThrow(ConflictException);
  });
});

