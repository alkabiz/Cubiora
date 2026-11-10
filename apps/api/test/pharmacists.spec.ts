import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PharmacistOperationalRole,
  PharmacistStatus,
  TicketStatus,
  UserRole,
  WorkShift,
} from '@cubiora/shared';
import { PharmacistsService } from '../src/modules/pharmacists/pharmacists.service';
import { PharmacistsController } from '../src/modules/pharmacists/pharmacists.controller';
import { CreatePharmacistDto } from '../src/modules/pharmacists/dto/create-pharmacist.dto';
import { UpdatePharmacistStatusDto } from '../src/modules/pharmacists/dto/update-pharmacist-status.dto';

describe('[SCR-ADM-004] PharmacistsModule – Servicio, DTOs y RBAC', () => {
  let mockPrisma: any;
  let mockTelemetry: any;
  let service: PharmacistsService;

  beforeEach(() => {
    mockTelemetry = {
      emitCubicleUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const txClient = {
      pharmacist: {
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        delete: vi.fn().mockResolvedValue({ id: 'ph-1' }),
      },
      cubicle: {
        update: vi.fn().mockResolvedValue({ id: 'cub-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockPrisma = {
      __tx: txClient,
      pharmacist: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: txClient.pharmacist.create,
        update: txClient.pharmacist.update,
        updateMany: txClient.pharmacist.updateMany,
        delete: txClient.pharmacist.delete,
      },
      facility: {
        findUnique: vi.fn(),
      },
      cubicle: {
        findUnique: vi.fn(),
        update: txClient.cubicle.update,
        updateMany: txClient.cubicle.updateMany,
      },
      ticket: {
        findMany: vi.fn().mockResolvedValue([
          {
            serviceStartedAt: new Date(Date.now() - 4 * 60 * 1000),
            closedAt: new Date(),
          },
          {
            serviceStartedAt: new Date(Date.now() - 6 * 60 * 1000),
            closedAt: new Date(),
          },
        ]),
      },
      $transaction: vi.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient)),
    };

    service = new PharmacistsService(mockPrisma, mockTelemetry);
  });

  it('valida CreatePharmacistDto normalizando matrícula en mayúsculas y email en minúsculas', async () => {
    const dto = plainToInstance(CreatePharmacistDto, {
      fullName: '  Lic. R. Mendoza  ',
      licenseNumber: ' mn-4812 ',
      operationalRole: PharmacistOperationalRole.TITULAR,
      shift: WorkShift.MORNING,
      email: ' R.MENDOZA@CUBIORA.HOSPITAL ',
      facilityId: '',
      cubicleId: null,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.fullName).toBe('Lic. R. Mendoza');
    expect(dto.licenseNumber).toBe('MN-4812');
    expect(dto.email).toBe('r.mendoza@cubiora.hospital');
    expect(dto.facilityId).toBeNull();
    expect(dto.cubicleId).toBeNull();
  });

  it('rechaza correo inválido o rol desconocido en DTOs', async () => {
    const invalidCreate = plainToInstance(CreatePharmacistDto, {
      fullName: 'A',
      licenseNumber: 'MN-1',
      operationalRole: 'INVALID_ROLE',
      shift: WorkShift.MORNING,
      email: 'no-es-un-correo',
    });

    const errors = await validate(invalidCreate);
    expect(errors.length).toBeGreaterThanOrEqual(2);

    const statusDto = plainToInstance(UpdatePharmacistStatusDto, {
      status: PharmacistStatus.ON_LEAVE,
    });
    expect(await validate(statusDto)).toHaveLength(0);
  });

  it('findAll calcula métricas KPI y promedio real desde tickets cerrados', async () => {
    mockPrisma.pharmacist.findMany
      .mockResolvedValueOnce([
        {
          id: 'ph-1',
          userId: 'usr-1',
          fullName: 'Lic. R. Mendoza',
          licenseNumber: 'MN-4812',
          operationalRole: PharmacistOperationalRole.TITULAR,
          facilityId: 'fac-1',
          cubicleId: 'cub-3',
          shift: WorkShift.MORNING,
          status: PharmacistStatus.ACTIVE,
          email: 'r.mendoza@cubiora.hospital',
          phone: '+54 11 4000-0001',
          dispatchesCount: 142,
          facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Punto de Dispensación Central' },
          cubicle: { id: 'cub-3', code: 'CUB-03', displayName: 'Cubículo 03' },
        },
      ])
      .mockResolvedValueOnce([
        { status: PharmacistStatus.ACTIVE, dispatchesCount: 142, facilityId: 'fac-1' },
        { status: PharmacistStatus.ON_LEAVE, dispatchesCount: 84, facilityId: 'fac-2' },
        { status: PharmacistStatus.INACTIVE, dispatchesCount: 10, facilityId: 'fac-1' },
      ]);

    const result = await service.findAll({ search: 'Mendoza', status: PharmacistStatus.ACTIVE });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.defaultCubicleName).toBe('Cubículo 03');
    expect(result.metrics).toEqual({
      totalRegistered: 3,
      activeToday: 1,
      onLeaveCount: 1,
      totalDispatches: 236,
      averageServiceMinutes: 5,
      assignedFacilitiesCount: 2,
    });
  });

  it('create valida duplicados (409) y sincroniza Cubicle.operatorName al asignar cubículo', async () => {
    mockPrisma.pharmacist.findFirst.mockResolvedValueOnce({
      id: 'ph-existing',
      licenseNumber: 'MN-4812',
      email: 'otro@cubiora.hospital',
    });

    await expect(
      service.create({
        fullName: 'Lic. Nuevo',
        licenseNumber: 'MN-4812',
        operationalRole: PharmacistOperationalRole.TITULAR,
        shift: WorkShift.MORNING,
        email: 'nuevo@cubiora.hospital',
      }),
    ).rejects.toThrow(ConflictException);

    mockPrisma.pharmacist.findFirst.mockResolvedValueOnce(null);
    mockPrisma.facility.findUnique.mockResolvedValueOnce({ id: 'fac-1' });
    mockPrisma.cubicle.findUnique.mockResolvedValueOnce({ id: 'cub-3', facilityId: 'fac-1' });
    mockPrisma.__tx.pharmacist.create.mockResolvedValueOnce({
      id: 'ph-new',
      userId: null,
      fullName: 'Lic. R. Mendoza',
      licenseNumber: 'MN-4812',
      operationalRole: PharmacistOperationalRole.TITULAR,
      facilityId: 'fac-1',
      cubicleId: 'cub-3',
      shift: WorkShift.MORNING,
      status: PharmacistStatus.ACTIVE,
      email: 'r.mendoza@cubiora.hospital',
      phone: '',
      dispatchesCount: 0,
      facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Central' },
      cubicle: { id: 'cub-3', code: 'CUB-03', displayName: 'Cubículo 03' },
    });

    const created = await service.create({
      fullName: 'Lic. R. Mendoza',
      licenseNumber: 'MN-4812',
      operationalRole: PharmacistOperationalRole.TITULAR,
      facilityId: 'fac-1',
      cubicleId: 'cub-3',
      shift: WorkShift.MORNING,
      email: 'r.mendoza@cubiora.hospital',
    });

    expect(created.id).toBe('ph-new');
    expect(mockPrisma.__tx.cubicle.update).toHaveBeenCalledWith({
      where: { id: 'cub-3' },
      data: { operatorName: 'Lic. R. Mendoza', version: { increment: 1 } },
    });
    expect(mockTelemetry.emitCubicleUpdate).toHaveBeenCalledWith('cub-3');
    expect(mockTelemetry.broadcastSnapshot).toHaveBeenCalled();
  });

  it('updateStatus limpia Cubicle.operatorName al pasar a INACTIVE y emite telemetría', async () => {
    mockPrisma.pharmacist.findUnique.mockResolvedValueOnce({
      id: 'ph-1',
      fullName: 'Lic. R. Mendoza',
      cubicleId: 'cub-3',
    });
    mockPrisma.__tx.pharmacist.update.mockResolvedValueOnce({
      id: 'ph-1',
      userId: null,
      fullName: 'Lic. R. Mendoza',
      licenseNumber: 'MN-4812',
      operationalRole: PharmacistOperationalRole.TITULAR,
      facilityId: 'fac-1',
      cubicleId: 'cub-3',
      shift: WorkShift.MORNING,
      status: PharmacistStatus.INACTIVE,
      email: 'r.mendoza@cubiora.hospital',
      phone: '',
      dispatchesCount: 142,
      facility: { id: 'fac-1', code: 'SEDE-CEN-01', name: 'Central' },
      cubicle: { id: 'cub-3', code: 'CUB-03', displayName: 'Cubículo 03' },
    });

    const updated = await service.updateStatus('ph-1', PharmacistStatus.INACTIVE);

    expect(updated.status).toBe(PharmacistStatus.INACTIVE);
    expect(mockPrisma.__tx.cubicle.update).toHaveBeenCalledWith({
      where: { id: 'cub-3' },
      data: { operatorName: null, version: { increment: 1 } },
    });
    expect(mockTelemetry.emitCubicleUpdate).toHaveBeenCalledWith('cub-3');
  });

  it('remove limpia Cubicle.operatorName y lanza NotFoundException si no existe', async () => {
    mockPrisma.pharmacist.findUnique.mockResolvedValueOnce(null);
    await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);

    mockPrisma.pharmacist.findUnique.mockResolvedValueOnce({
      id: 'ph-1',
      fullName: 'Lic. R. Mendoza',
      cubicleId: 'cub-3',
    });

    const removed = await service.remove('ph-1');
    expect(removed).toEqual({ deleted: true, id: 'ph-1' });
    expect(mockPrisma.__tx.cubicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'cub-3', operatorName: 'Lic. R. Mendoza' },
      data: { operatorName: null, version: { increment: 1 } },
    });
    expect(mockPrisma.__tx.pharmacist.delete).toHaveBeenCalledWith({ where: { id: 'ph-1' } });
  });

  it('PharmacistsController protege todos sus endpoints con @Roles(UserRole.ADMIN)', () => {
    const methods: Array<keyof PharmacistsController> = [
      'findAll',
      'create',
      'update',
      'updateStatus',
      'remove',
    ];
    for (const method of methods) {
      const roles = Reflect.getMetadata('roles', PharmacistsController.prototype[method]);
      expect(roles).toEqual([UserRole.ADMIN]);
    }
  });
});

