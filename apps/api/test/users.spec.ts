import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PharmacistStatus, UserRole } from '@cubiora/shared';
import { UsersService } from '../src/modules/users/users.service';
import { UsersController } from '../src/modules/users/users.controller';
import { CreateUserDto } from '../src/modules/users/dto/create-user.dto';
import { ResetUserPasswordDto } from '../src/modules/users/dto/reset-user-password.dto';

describe('[SCR-ADM-005] UsersModule – Gestión de Cuentas Operativas', () => {
  let mockPrisma: any;
  let service: UsersService;

  const baseNow = new Date('2026-11-11T08:00:00.000Z');

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      cubicle: {
        findUnique: vi.fn(),
      },
    };
    service = new UsersService(mockPrisma);
  });

  it('valida CreateUserDto y ResetUserPasswordDto (normaliza username y exige contraseña >= 8 caracteres)', async () => {
    const validDto = plainToInstance(CreateUserDto, {
      username: '  Cajero_Norte_1 ',
      displayName: '  Cajero Sede Norte  ',
      password: 'Password2026!',
      role: UserRole.CASHIER,
      cubicleId: '',
    });
    expect(await validate(validDto)).toHaveLength(0);
    expect(validDto.username).toBe('cajero_norte_1');
    expect(validDto.displayName).toBe('Cajero Sede Norte');
    expect(validDto.cubicleId).toBeNull();

    const invalidDto = plainToInstance(CreateUserDto, {
      username: 'usuario invalido!',
      displayName: 'A',
      password: '123',
      role: UserRole.CASHIER,
    });
    expect((await validate(invalidDto)).length).toBeGreaterThanOrEqual(3);

    const weakReset = plainToInstance(ResetUserPasswordDto, { newPassword: 'short' });
    expect((await validate(weakReset)).length).toBeGreaterThanOrEqual(1);
  });

  it('findAll lista cuentas sin incluir passwordHash y mapea cubículo asignado', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'usr-1',
        publicId: 'pub-1',
        username: 'cajero1',
        displayName: 'Cajero Cubículo 1',
        role: UserRole.CASHIER,
        cubicleId: 'cub-1',
        active: true,
        createdAt: baseNow,
        updatedAt: baseNow,
        cubicle: { code: 'CUB-01', displayName: 'Cubículo 01' },
      },
    ]);

    const items = await service.findAll({ role: UserRole.CASHIER });

    expect(items).toHaveLength(1);
    expect(items[0]?.cubicleCode).toBe('CUB-01');
    expect((items[0] as any).passwordHash).toBeUndefined();
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
  });

  it('create hashea la contraseña, valida duplicados y conflictos de cubículo (409)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'usr-existing' });
    await expect(
      service.create({
        username: 'admin_cubiora',
        displayName: 'Dup',
        password: 'Password2026!',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(ConflictException);

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cubicle.findUnique.mockResolvedValueOnce({ id: 'cub-1', code: 'CUB-01' });
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: 'usr-c1',
      username: 'cajero1',
      displayName: 'Cajero 1',
    });

    await expect(
      service.create({
        username: 'cajero_nuevo',
        displayName: 'Cajero Nuevo',
        password: 'Password2026!',
        role: UserRole.CASHIER,
        cubicleId: 'cub-1',
      }),
    ).rejects.toThrow(ConflictException);

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cubicle.findUnique.mockResolvedValueOnce({ id: 'cub-2', code: 'CUB-02' });
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: 'usr-new',
      publicId: 'pub-new',
      username: 'cajero_nuevo',
      displayName: 'Cajero Nuevo',
      role: UserRole.CASHIER,
      cubicleId: 'cub-2',
      active: true,
      createdAt: baseNow,
      updatedAt: baseNow,
      cubicle: { code: 'CUB-02', displayName: 'Cubículo 02' },
    });

    const created = await service.create({
      username: 'cajero_nuevo',
      displayName: 'Cajero Nuevo',
      password: 'Password2026!',
      role: UserRole.CASHIER,
      cubicleId: 'cub-2',
    });

    expect(created.username).toBe('cajero_nuevo');
    expect((created as any).passwordHash).toBeUndefined();
    const createArgs = mockPrisma.user.create.mock.calls[0][0].data;
    expect(createArgs.passwordHash).not.toBe('Password2026!');
    expect(await bcrypt.compare('Password2026!', createArgs.passwordHash)).toBe(true);
  });

  it('update impide auto-desactivarse o revocarse el rol ADMIN a sí mismo (409)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'usr-admin',
      publicId: 'pub-admin',
      username: 'admin_cubiora',
      role: UserRole.ADMIN,
      cubicleId: null,
      active: true,
    });

    const selfActor = {
      id: 'usr-admin',
      publicId: 'pub-admin',
      username: 'admin_cubiora',
      displayName: 'Admin',
      role: UserRole.ADMIN,
      cubicleId: null,
    };

    await expect(
      service.update('usr-admin', { active: false }, selfActor),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.update('usr-admin', { role: UserRole.CASHIER }, selfActor),
    ).rejects.toThrow(ConflictException);
  });

  it('resetPassword actualiza hash bcrypt y lanza NotFoundException si no existe', async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(service.resetPassword('missing', 'NewPass2026!')).rejects.toThrow(
      NotFoundException,
    );

    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'usr-2', username: 'recepcion' });
    mockPrisma.user.update.mockResolvedValueOnce({ id: 'usr-2' });

    const res = await service.resetPassword('usr-2', 'NewPass2026!');
    expect(res).toEqual({ reset: true, id: 'usr-2', username: 'recepcion' });
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('NewPass2026!', updateData.passwordHash)).toBe(true);
  });

  it('UsersController protege todos sus endpoints con @Roles(UserRole.ADMIN)', () => {
    const methods: Array<keyof UsersController> = [
      'findAll',
      'create',
      'update',
      'resetPassword',
    ];
    for (const method of methods) {
      const roles = Reflect.getMetadata('roles', UsersController.prototype[method]);
      expect(roles).toEqual([UserRole.ADMIN]);
    }
  });

  it('update en modo transaccional sincroniza Pharmacist vinculada (cubicleId, facilityId, fullName), Cubicle.operatorName y telemetría', async () => {
    const telemetryMock = {
      emitCubicleUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const txClient: any = {
      user: {
        update: vi.fn().mockResolvedValue({
          id: 'usr-c1',
          publicId: 'pub-c1',
          username: 'cajero1',
          displayName: 'Lic. M. Arismendi Renombrada',
          role: UserRole.CASHIER,
          cubicleId: 'cub-2',
          active: true,
          createdAt: baseNow,
          updatedAt: baseNow,
          cubicle: { code: 'CUB-02', displayName: 'Cubículo 02' },
        }),
      },
      cubicle: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where.id === 'cub-2') {
            return {
              id: 'cub-2',
              facilityId: 'fac-2',
              currentOperator: {
                displayName: 'Lic. M. Arismendi Renombrada',
                role: UserRole.CASHIER,
                active: true,
              },
              pharmacists: [
                { fullName: 'Lic. M. Arismendi Renombrada', status: PharmacistStatus.ACTIVE },
              ],
            };
          }
          if (where.id === 'cub-1') {
            return {
              id: 'cub-1',
              facilityId: 'fac-1',
              currentOperator: null,
              pharmacists: [],
            };
          }
          return null;
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      pharmacist: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ph-1',
          fullName: 'Lic. M. Arismendi',
          cubicleId: 'cub-1',
          facilityId: 'fac-1',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({ id: 'ph-1' }),
      },
    };

    const fullPrisma: any = {
      user: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'usr-c1',
            publicId: 'pub-c1',
            username: 'cajero1',
            displayName: 'Lic. M. Arismendi',
            role: UserRole.CASHIER,
            cubicleId: 'cub-1',
            active: true,
          })
          .mockResolvedValueOnce(null),
      },
      cubicle: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cub-2', code: 'CUB-02' }),
        update: txClient.cubicle.update,
      },
      pharmacist: txClient.pharmacist,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(txClient)),
    };

    const syncedService = new UsersService(fullPrisma, telemetryMock as any);

    const updated = await syncedService.update('usr-c1', {
      displayName: 'Lic. M. Arismendi Renombrada',
      cubicleId: 'cub-2',
    });

    expect(updated.cubicleId).toBe('cub-2');
    expect(txClient.pharmacist.updateMany).toHaveBeenCalledWith({
      where: { cubicleId: 'cub-2', id: { not: 'ph-1' } },
      data: { cubicleId: null },
    });
    expect(txClient.pharmacist.update).toHaveBeenCalledWith({
      where: { id: 'ph-1' },
      data: {
        cubicleId: 'cub-2',
        facilityId: 'fac-2',
        fullName: 'Lic. M. Arismendi Renombrada',
      },
    });
    expect(txClient.cubicle.update).toHaveBeenCalledWith({
      where: { id: 'cub-1' },
      data: { operatorName: null, version: { increment: 1 } },
    });
    expect(txClient.cubicle.update).toHaveBeenCalledWith({
      where: { id: 'cub-2' },
      data: { operatorName: 'Lic. M. Arismendi Renombrada', version: { increment: 1 } },
    });
    expect(telemetryMock.emitCubicleUpdate).toHaveBeenCalledWith('cub-1');
    expect(telemetryMock.emitCubicleUpdate).toHaveBeenCalledWith('cub-2');
    expect(telemetryMock.broadcastSnapshot).toHaveBeenCalled();
  });
});

