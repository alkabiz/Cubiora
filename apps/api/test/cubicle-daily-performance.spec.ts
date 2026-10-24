import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { TicketStatus, UserRole } from '@cubiora/shared';
import { CubiclesController } from '../src/modules/cubicles/cubicles.controller';
import {
  CubiclesService,
  DEFAULT_DAILY_TARGET_SECONDS,
  resolveDailyTargetSeconds,
} from '../src/modules/cubicles/cubicles.service';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';

interface FakeTicket {
  cubicleId: string;
  status: TicketStatus;
  serviceStartedAt: Date | null;
  closedAt: Date | null;
  patientName: string;
  patientDocument: string | null;
}

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user_cashier',
    publicId: 'user_public',
    username: 'cajero',
    displayName: 'Cajero',
    role: UserRole.CASHIER,
    cubicleId: 'cub-03',
    ...overrides,
  };
}

function dayStart(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function atLocalHour(day: Date, hours: number, minutes = 0, seconds = 0): Date {
  const value = new Date(day);
  value.setHours(hours, minutes, seconds, 0);
  return value;
}

describe('Rendimiento diario por cubículo', () => {
  const cubicles = [
    { id: 'cub-03', code: 'CUB-03' },
    { id: 'cub-01', code: 'CUB-01' },
  ];
  const users = [
    {
      id: 'user_cashier',
      role: UserRole.CASHIER,
      cubicleId: 'cub-03',
      active: true,
    },
    {
      id: 'user_cashier_unassigned',
      role: UserRole.CASHIER,
      cubicleId: null,
      active: true,
    },
    {
      id: 'user_admin',
      role: UserRole.ADMIN,
      cubicleId: null,
      active: true,
    },
    {
      id: 'user_reception',
      role: UserRole.RECEPTION,
      cubicleId: null,
      active: true,
    },
  ];

  let tickets: FakeTicket[];
  let mockPrisma: {
    cubicle: { findFirst: ReturnType<typeof vi.fn> };
    user: { findUnique: ReturnType<typeof vi.fn> };
    ticket: { findMany: ReturnType<typeof vi.fn> };
  };
  let service: CubiclesService;
  let controller: CubiclesController;

  beforeEach(() => {
    const now = new Date();
    const start = dayStart(now);
    tickets = [
      {
        cubicleId: 'cub-03',
        status: TicketStatus.CLOSED,
        serviceStartedAt: atLocalHour(start, 8, 0, 0),
        closedAt: atLocalHour(start, 8, 4, 45), // 285 s
        patientName: 'Paciente Uno',
        patientDocument: '1001',
      },
      {
        cubicleId: 'cub-03',
        status: TicketStatus.CLOSED,
        serviceStartedAt: atLocalHour(start, 9, 0, 0),
        closedAt: atLocalHour(start, 9, 5, 0), // 300 s
        patientName: 'Paciente Dos',
        patientDocument: '1002',
      },
      {
        cubicleId: 'cub-03',
        status: TicketStatus.CLOSED,
        serviceStartedAt: atLocalHour(start, 10, 0, 0),
        closedAt: atLocalHour(start, 10, 15, 0), // 900 s (> 720)
        patientName: 'Paciente Tres',
        patientDocument: '1003',
      },
      {
        cubicleId: 'cub-03',
        status: TicketStatus.NO_SHOW,
        serviceStartedAt: atLocalHour(start, 11, 0, 0),
        closedAt: atLocalHour(start, 11, 1, 0), // No debe entrar
        patientName: 'Paciente No Show',
        patientDocument: '1004',
      },
      {
        cubicleId: 'cub-03',
        status: TicketStatus.CANCELLED,
        serviceStartedAt: atLocalHour(start, 12, 0, 0),
        closedAt: atLocalHour(start, 12, 1, 0), // No debe entrar
        patientName: 'Paciente Cancelado',
        patientDocument: '1005',
      },
      {
        cubicleId: 'cub-01',
        status: TicketStatus.CLOSED,
        serviceStartedAt: atLocalHour(start, 8, 0, 0),
        closedAt: atLocalHour(start, 8, 2, 0),
        patientName: 'Paciente Otro Cubículo',
        patientDocument: '1006',
      },
    ];

    mockPrisma = {
      cubicle: {
        findFirst: vi.fn(async ({ where }: { where: { OR: Array<{ code: string }> } }) => {
          return (
            cubicles.find((cubicle) =>
              where.OR.some((condition) => condition.code === cubicle.code),
            ) ?? null
          );
        }),
      },
      user: {
        findUnique: vi.fn(
          async ({ where }: { where: { id: string } }) =>
            users.find((user) => user.id === where.id) ?? null,
        ),
      },
      ticket: {
        findMany: vi.fn(
          async ({
            where,
          }: {
            where: {
              cubicleId: string;
              status: TicketStatus;
              closedAt: { gte: Date; lt: Date };
            };
          }) =>
            tickets.filter(
              (ticket) =>
                ticket.cubicleId === where.cubicleId &&
                ticket.status === where.status &&
                ticket.closedAt !== null &&
                ticket.closedAt >= where.closedAt.gte &&
                ticket.closedAt < where.closedAt.lt,
            ),
        ),
      },
    };

    service = new CubiclesService(mockPrisma as unknown as PrismaService);
    controller = new CubiclesController(service);
  });

  afterEach(() => {
    delete process.env['CUBICLE_DAILY_TARGET_SECONDS'];
    vi.restoreAllMocks();
  });

  it('calcula las métricas con turnos CLOSED persistidos y excluye NO_SHOW/CANCELLED', async () => {
    const result = await service.getDailyPerformance('CUB-03', makeUser());

    expect(result.completedTickets).toBe(3);
    expect(result.averageServiceSeconds).toBe(495);
    expect(result.targetSeconds).toBe(DEFAULT_DAILY_TARGET_SECONDS);
    expect(result.targetCompliancePercentage).toBe(66.7);
    expect(Number.isNaN(result.averageServiceSeconds)).toBe(false);
    expect(Number.isFinite(result.targetCompliancePercentage)).toBe(true);
    expect(new Date(result.calculatedAt).toString()).not.toBe('Invalid Date');

    const query = mockPrisma.ticket.findMany.mock.calls[0]?.[0]?.where;
    expect(query.status).toBe(TicketStatus.CLOSED);
    expect(query.cubicleId).toBe('cub-03');
    expect(query.closedAt.gte).toBeInstanceOf(Date);
    expect(query.closedAt.lt).toBeInstanceOf(Date);
  });

  it('un CASHIER solo puede consultar su cubículo asignado', async () => {
    await expect(service.getDailyPerformance('CUB-01', makeUser())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('un CASHIER sin cubículo asignado recibe 403', async () => {
    await expect(
      service.getDailyPerformance(
        'CUB-03',
        makeUser({ id: 'user_cashier_unassigned', cubicleId: null }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un ADMIN puede consultar un cubículo autorizado', async () => {
    const result = await service.getDailyPerformance(
      'CUB-01',
      makeUser({
        id: 'user_admin',
        username: 'admin',
        role: UserRole.ADMIN,
        cubicleId: null,
      }),
    );

    expect(result.cubicleCode).toBe('CUB-01');
    expect(result.completedTickets).toBe(1);
    expect(result.averageServiceSeconds).toBe(120);
    expect(result.targetCompliancePercentage).toBe(100);
  });

  it('RECEPTION recibe 403 también a nivel de servicio', async () => {
    await expect(
      service.getDailyPerformance(
        'CUB-03',
        makeUser({
          id: 'user_reception',
          role: UserRole.RECEPTION,
          cubicleId: null,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('RolesGuard niega el endpoint a RECEPTION usando la metadata real del controlador', () => {
    const guard = new RolesGuard(new Reflector());
    const request = {
      user: { id: 'user_reception', role: UserRole.RECEPTION, cubicleId: null },
      params: { code: 'CUB-03' },
      query: {},
      body: {},
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => CubiclesController.prototype.getDailyPerformance,
      getClass: () => CubiclesController,
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('sin turnos cerrados devuelve null en promedio y cumplimiento, sin NaN ni Infinity', async () => {
    tickets = [];

    const result = await service.getDailyPerformance('CUB-03', makeUser());

    expect(result.completedTickets).toBe(0);
    expect(result.averageServiceSeconds).toBeNull();
    expect(result.targetCompliancePercentage).toBeNull();
    expect(result.averageServiceSeconds).not.toBeNaN();
    expect(result.targetCompliancePercentage).not.toBeNaN();
    expect(result.averageServiceSeconds).not.toBe(Infinity);
    expect(result.targetCompliancePercentage).not.toBe(Infinity);
  });

  it('usa el objetivo configurado en backend y limita el porcentaje a 100', async () => {
    process.env['CUBICLE_DAILY_TARGET_SECONDS'] = '600';

    const result = await service.getDailyPerformance('CUB-03', makeUser());

    expect(result.targetSeconds).toBe(600);
    // 285 s y 300 s cumplen; 900 s no: 2/3 = 66.7 %
    expect(result.targetCompliancePercentage).toBe(66.7);

    delete process.env['CUBICLE_DAILY_TARGET_SECONDS'];
    expect(resolveDailyTargetSeconds(undefined)).toBe(DEFAULT_DAILY_TARGET_SECONDS);
  });

  it('la respuesta del controlador no expone nombres, documentos ni datos personales', async () => {
    const response = await controller.getDailyPerformance('CUB-03', makeUser());

    expect(response.success).toBe(true);
    expect(Object.keys(response.data).sort()).toEqual(
      [
        'averageServiceSeconds',
        'calculatedAt',
        'completedTickets',
        'cubicleCode',
        'targetCompliancePercentage',
        'targetSeconds',
      ].sort(),
    );

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('Paciente Uno');
    expect(serialized).not.toContain('1001');
    expect(serialized).not.toContain('patientName');
    expect(serialized).not.toContain('patientDocument');
    expect(serialized).not.toContain('document');
  });
});
