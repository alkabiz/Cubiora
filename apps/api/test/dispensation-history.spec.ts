import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PublicDisplayService } from '../src/modules/public-display/public-display.service';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import {
  CubicleStatus,
  DispensationResolution,
  QueueCategory,
  TicketStatus,
  UserRole,
} from '@cubiora/shared';

describe('Auditoría Farmacéutica · Dispensación y Resolución 1604 (Fases 1, 2 y 3)', () => {
  let ticketsService: TicketsService;
  let mockPrisma: any;
  let mockPublicDisplayService: any;
  let mockCubiclesService: any;

  beforeEach(() => {
    mockPrisma = {
      ticket: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      cubicle: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      dispensationRecord: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      pharmacist: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ticketStatusHistory: {
        create: vi.fn(),
      },
      idempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    mockPublicDisplayService = {
      broadcastTicketCalled: vi.fn(),
      broadcastTicketRecalled: vi.fn(),
    };

    mockCubiclesService = {
      getCubicleSnapshotByCode: vi.fn(),
      buildCubicleSnapshot: vi.fn(),
      getDailyPerformance: vi.fn(),
    };

    ticketsService = new TicketsService(
      mockPrisma as PrismaService,
      mockPublicDisplayService as PublicDisplayService,
      mockCubiclesService as CubiclesService,
    );
  });

  describe('Cierre de Turno con Dispensación Farmacéutica (SCR-CAJ-001)', () => {
    const ticketInService = {
      id: 'ticket-1',
      publicId: '01JDISP001',
      publicCode: 'TUR-000001-GE',
      patientName: 'Carlos Gómez',
      status: TicketStatus.IN_SERVICE,
      cubicleId: 'cub-1',
      version: 1,
      createdAt: new Date(),
    };

    it('Rechaza radicación de pendiente 48h (PENDING_48H) si falta la dirección de entrega domiciliaria', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(ticketInService);
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketInService);

      await expect(
        ticketsService.closeTicket(
          '01JDISP001',
          'user-1',
          'corr-1',
          undefined,
          1,
          undefined,
          null,
          {
            expectedVersion: 1,
            resolution: DispensationResolution.PENDING_48H,
            deliveryPhone: '3001234567',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Rechaza radicación de pendiente 48h (PENDING_48H) si falta el teléfono de contacto', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(ticketInService);
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketInService);

      await expect(
        ticketsService.closeTicket(
          '01JDISP001',
          'user-1',
          'corr-1',
          undefined,
          1,
          undefined,
          null,
          {
            expectedVersion: 1,
            resolution: DispensationResolution.PENDING_48H,
            deliveryAddress: 'Cra 43A # 12-45',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Cierra con PENDING_48H, calcula deadline a +48 horas y persiste el registro de dispensación', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(ticketInService);
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketInService);
      mockPrisma.ticket.update.mockResolvedValue({ ...ticketInService, status: TicketStatus.CLOSED });
      mockCubiclesService.buildCubicleSnapshot.mockResolvedValue({
        cubicle: { id: 'cub-1', code: 'CUB-01', displayName: 'Cubículo 01' },
        activeTicket: null,
      });

      const beforeNow = Date.now();
      const result = await ticketsService.closeTicket(
        '01JDISP001',
        'user-1',
        'corr-1',
        undefined,
        1,
        undefined,
        null,
        {
          expectedVersion: 1,
          resolution: DispensationResolution.PENDING_48H,
          prescriptionCode: 'FORM-998877',
          deliveryAddress: 'Calle 100 # 15-20 Apto 401',
          deliveryPhone: '3109876543',
          pendingDetailsJson: 'Atorvastatina 20mg x 30 tabletas',
          itemsPendingCount: 1,
        },
      );

      expect(mockPrisma.ticket.update).toHaveBeenCalled();
      expect(mockPrisma.dispensationRecord.create).toHaveBeenCalled();

      const createdRecord = mockPrisma.dispensationRecord.create.mock.calls[0][0].data;
      expect(createdRecord.resolution).toBe(DispensationResolution.PENDING_48H);
      expect(createdRecord.prescriptionCode).toBe('FORM-998877');
      expect(createdRecord.deliveryAddress).toBe('Calle 100 # 15-20 Apto 401');
      expect(createdRecord.deliveryPhone).toBe('3109876543');
      expect(createdRecord.itemsPendingCount).toBe(1);

      // Verificación de la promesa legal: deadline = now + 48 horas (±5 segundos de margen de ejecución)
      const expectedDeadlineMs = beforeNow + 48 * 60 * 60 * 1000;
      const actualDeadlineMs = new Date(createdRecord.deliveryDeadline).getTime();
      expect(Math.abs(actualDeadlineMs - expectedDeadlineMs)).toBeLessThan(5000);
    });

    it('Cierra con TOTAL_DELIVERED por defecto sin exigir dirección ni teléfono domiciliario', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(ticketInService);
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketInService);
      mockPrisma.ticket.update.mockResolvedValue({ ...ticketInService, status: TicketStatus.CLOSED });
      mockCubiclesService.buildCubicleSnapshot.mockResolvedValue({
        cubicle: { id: 'cub-1', code: 'CUB-01', displayName: 'Cubículo 01' },
        activeTicket: null,
      });

      await ticketsService.closeTicket(
        '01JDISP001',
        'user-1',
        'corr-1',
        undefined,
        1,
        undefined,
        null,
        {
          expectedVersion: 1,
        },
      );

      expect(mockPrisma.ticket.update).toHaveBeenCalled();
      expect(mockPrisma.dispensationRecord.create).toHaveBeenCalled();
      const createdRecord = mockPrisma.dispensationRecord.create.mock.calls[0][0].data;
      expect(createdRecord.resolution).toBe(DispensationResolution.TOTAL_DELIVERED);
      expect(createdRecord.deliveryDeadline).toBeNull();
    });
  });

  describe('Historial Operativo y Auditoría de Turnos (SCR-ADM-003)', () => {
    it('Retorna registros paginados calculando duración y SLA en norma (< 12 min)', async () => {
      const now = new Date();
      const created = new Date(now.getTime() - 10 * 60 * 1000); // 10 min antes
      const serviceStarted = new Date(now.getTime() - 5 * 60 * 1000); // 5 min de atención
      const closed = now;

      mockPrisma.ticket.count.mockResolvedValue(1);
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          id: 'tick-aud-1',
          publicId: '01JAUD001',
          publicCode: 'TUR-000100-GE',
          patientName: 'Ana María Restrepo',
          patientDocument: '1020304050',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.GENERAL,
          createdAt: created,
          calledAt: serviceStarted,
          serviceStartedAt: serviceStarted,
          closedAt: closed,
          cubicle: { code: 'CUB-01', displayName: 'Cubículo 01', operatorName: 'Farm. J. Pérez' },
          dispensation: {
            id: 'disp-1',
            ticketId: 'tick-aud-1',
            cubicleId: 'cub-1',
            operatorUserId: 'usr-1',
            resolution: DispensationResolution.TOTAL_DELIVERED,
            prescriptionCode: 'MIPRES-1234',
            mipresNumber: null,
            itemsDeliveredCount: 2,
            itemsPendingCount: 0,
            pendingDetailsJson: null,
            deliveryAddress: null,
            deliveryPhone: null,
            deliveryDeadline: null,
            createdAt: now,
          },
        },
      ]);

      const history = await ticketsService.getTicketHistory({
        page: 1,
        limit: 10,
      });

      expect(history.total).toBe(1);
      expect(history.items).toHaveLength(1);
      const item = history.items[0];
      expect(item.publicCode).toBe('TUR-000100-GE');
      expect(item.serviceDurationSeconds).toBe(300); // 5 min
      expect(item.slaCompliant).toBe(true);
      expect(item.dispensation?.resolution).toBe(DispensationResolution.TOTAL_DELIVERED);
      expect(item.dispensation?.prescriptionCode).toBe('MIPRES-1234');
    });

    it('Filtra correctamente por SLA excedido cuando slaFilter = EXCEEDED', async () => {
      const now = new Date();
      const serviceStarted = new Date(now.getTime() - 15 * 60 * 1000); // 15 min de atención (excede 12 min)

      mockPrisma.ticket.count.mockResolvedValue(1);
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          id: 'tick-aud-2',
          publicId: '01JAUD002',
          publicCode: 'TUR-000101-GE',
          patientName: 'Pedro Infante',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.GENERAL,
          createdAt: serviceStarted,
          calledAt: serviceStarted,
          serviceStartedAt: serviceStarted,
          closedAt: now,
          cubicle: { code: 'CUB-02', displayName: 'Cubículo 02', operatorName: 'Farm. L. Gómez' },
          dispensation: null,
        },
      ]);

      const history = await ticketsService.getTicketHistory({
        slaFilter: 'EXCEEDED',
        page: 1,
        limit: 10,
      });

      expect(history.items).toHaveLength(1);
      expect(history.items[0].slaCompliant).toBe(false);
      expect(history.items[0].serviceDurationSeconds).toBe(900); // 15 min
    });

    it('Usa CUBICLE_DAILY_TARGET_SECONDS como umbral unificado de cumplimiento SLA en el historial', async () => {
      vi.stubEnv('CUBICLE_DAILY_TARGET_SECONDS', '600'); // 10 min
      try {
        const now = new Date();
        const serviceStarted = new Date(now.getTime() - 650 * 1000); // 10m 50s -> cumple 720s, excede 600s

        mockPrisma.ticket.count.mockResolvedValue(1);
        mockPrisma.ticket.findMany.mockResolvedValue([
          {
            id: 'tick-aud-3',
            publicId: '01JAUD003',
            publicCode: 'TUR-000102-GE',
            patientName: 'Laura Vélez',
            status: TicketStatus.CLOSED,
            queueCategory: QueueCategory.GENERAL,
            createdAt: serviceStarted,
            calledAt: serviceStarted,
            serviceStartedAt: serviceStarted,
            closedAt: now,
            cubicle: { code: 'CUB-01', displayName: 'Cubículo 01', operatorName: 'Farm. M. Arismendi' },
            dispensation: null,
          },
        ]);

        const history = await ticketsService.getTicketHistory({ page: 1, limit: 10 });
        expect(history.slaThresholdSeconds).toBe(600);
        expect(history.items[0].slaCompliant).toBe(false);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('closeTicket propaga error de dispensationRecord.create sin silenciarlo e incrementa dispatchesCount al cerrar', async () => {
      const ticketInService = {
        id: 'ticket-atom-1',
        publicId: '01JATOM001',
        publicCode: 'TUR-000500-GE',
        patientName: 'Paciente Atómico',
        status: TicketStatus.IN_SERVICE,
        cubicleId: 'cub-1',
        version: 2,
        createdAt: new Date(),
      };
      mockPrisma.ticket.findFirst.mockResolvedValue(ticketInService);
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketInService);
      mockPrisma.ticket.update.mockResolvedValue({ ...ticketInService, status: TicketStatus.CLOSED });
      mockPrisma.dispensationRecord.create.mockRejectedValueOnce(new Error('DB write failure'));

      await expect(
        ticketsService.closeTicket(
          '01JATOM001',
          'user-1',
          'corr-atom',
          undefined,
          2,
        ),
      ).rejects.toThrow('DB write failure');

      mockPrisma.dispensationRecord.create.mockResolvedValueOnce({ id: 'disp-ok' });
      mockCubiclesService.buildCubicleSnapshot.mockResolvedValue({
        cubicle: { id: 'cub-1', code: 'CUB-01', displayName: 'Cubículo 01', status: CubicleStatus.AVAILABLE },
        activeTicket: null,
      });

      await ticketsService.closeTicket('01JATOM001', 'user-1', 'corr-atom-2', undefined, 2);
      expect(mockPrisma.pharmacist.updateMany).toHaveBeenCalledWith({
        where: { cubicleId: 'cub-1', status: { not: 'INACTIVE' } },
        data: { dispatchesCount: { increment: 1 } },
      });
    });

    it('cancelTicket cancela turnos PENDING o ASSIGNED, libera cubículo, y rechaza IN_SERVICE o BOLA CASHIER', async () => {
      const pendingTicket = {
        id: 'tick-p1',
        publicId: '01JCANC001',
        publicCode: 'TUR-000601-GE',
        status: TicketStatus.PENDING,
        cubicleId: null,
        version: 1,
        createdAt: new Date(),
      };
      mockPrisma.ticket.findFirst.mockResolvedValueOnce(pendingTicket);
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(pendingTicket);

      const resPending = await ticketsService.cancelTicket(
        '01JCANC001',
        'rec-1',
        'corr-c1',
        undefined,
        1,
        UserRole.RECEPTION,
        null,
        'Paciente se retiró',
      );
      expect(resPending.data).toEqual({
        cancelled: true,
        publicId: '01JCANC001',
        publicCode: 'TUR-000601-GE',
        status: TicketStatus.CANCELLED,
        cubicleSnapshot: null,
      });

      // CASHIER no puede cancelar PENDING sin cubículo ni de otro cubículo
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({
        ...pendingTicket,
        status: TicketStatus.ASSIGNED,
        cubicleId: 'cub-2',
      });
      await expect(
        ticketsService.cancelTicket(
          '01JCANC001',
          'cashier-1',
          'corr-c2',
          undefined,
          1,
          UserRole.CASHIER,
          'cub-1',
        ),
      ).rejects.toThrow(ForbiddenException);

      // IN_SERVICE debe cerrarse mediante closeTicket (409)
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({
        ...pendingTicket,
        status: TicketStatus.IN_SERVICE,
        cubicleId: 'cub-1',
      });
      await expect(
        ticketsService.cancelTicket(
          '01JCANC001',
          'admin-1',
          'corr-c3',
          undefined,
          1,
          UserRole.ADMIN,
          null,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('getTicketHistory pagina correctamente sobre la colección filtrada cuando slaFilter está activo', async () => {
      const now = new Date();
      const shortStart = new Date(now.getTime() - 2 * 60 * 1000); // 120s (en norma)
      const longStart = new Date(now.getTime() - 20 * 60 * 1000); // 1200s (excede)

      mockPrisma.ticket.findMany.mockResolvedValueOnce([
        {
          id: 't1',
          publicId: '01JPAG001',
          publicCode: 'TUR-000701-GE',
          patientName: 'Uno',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.GENERAL,
          createdAt: shortStart,
          calledAt: shortStart,
          serviceStartedAt: shortStart,
          closedAt: now,
          cubicle: { code: 'CUB-01', displayName: 'Cubículo 01' },
          dispensation: null,
        },
        {
          id: 't2',
          publicId: '01JPAG002',
          publicCode: 'TUR-000702-GE',
          patientName: 'Dos Excedido',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.GENERAL,
          createdAt: longStart,
          calledAt: longStart,
          serviceStartedAt: longStart,
          closedAt: now,
          cubicle: { code: 'CUB-01', displayName: 'Cubículo 01' },
          dispensation: null,
        },
        {
          id: 't3',
          publicId: '01JPAG003',
          publicCode: 'TUR-000703-GE',
          patientName: 'Tres Excedido',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.GENERAL,
          createdAt: longStart,
          calledAt: longStart,
          serviceStartedAt: longStart,
          closedAt: now,
          cubicle: { code: 'CUB-02', displayName: 'Cubículo 02' },
          dispensation: null,
        },
        {
          id: 't4',
          publicId: '01JPAG004',
          publicCode: 'TUR-000704-GE',
          patientName: 'Cuatro Excedido',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.GENERAL,
          createdAt: longStart,
          calledAt: longStart,
          serviceStartedAt: longStart,
          closedAt: now,
          cubicle: { code: 'CUB-02', displayName: 'Cubículo 02' },
          dispensation: null,
        },
      ]);

      const page2 = await ticketsService.getTicketHistory({
        slaFilter: 'EXCEEDED',
        page: 2,
        limit: 2,
      });

      expect(page2.total).toBe(3);
      expect(page2.totalPages).toBe(2);
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.publicCode).toBe('TUR-000704-GE');
    });

    it('getTicketTimeline retorna línea de tiempo cronológica completa con documento enmascarado', async () => {
      const t0 = new Date('2026-11-11T09:00:00.000Z');
      const t1 = new Date('2026-11-11T09:02:00.000Z');
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({
        id: 't-tl-1',
        publicId: '01JTL0001',
        publicCode: 'TUR-000888-GE',
        patientName: 'Elena Naranjo',
        patientDocument: '1020304050',
        status: TicketStatus.CLOSED,
        queueCategory: QueueCategory.GENERAL,
        terminalReason: null,
        createdAt: t0,
        calledAt: t1,
        serviceStartedAt: t1,
        closedAt: new Date('2026-11-11T09:05:00.000Z'),
        cubicle: { code: 'CUB-02', displayName: 'Cubículo 02', operatorName: 'Farm. Prueba' },
        dispensation: null,
        statusHistory: [
          {
            id: 'h-1',
            fromStatus: null,
            toStatus: TicketStatus.PENDING,
            cubicle: null,
            actor: { displayName: 'Recepción Central', role: UserRole.RECEPTION },
            reasonCode: 'TICKET_CREATED',
            correlationId: 'corr-1',
            createdAt: t0,
          },
        ],
        calls: [
          {
            id: 'c-1',
            callNumber: 1,
            cubicle: { code: 'CUB-02', displayName: 'Cubículo 02' },
            caller: { displayName: 'Cajero 2' },
            createdAt: t1,
          },
        ],
      });

      const timeline = await ticketsService.getTicketTimeline('01JTL0001');
      expect(timeline.ticket.publicCode).toBe('TUR-000888-GE');
      expect(timeline.ticket.maskedDocument).toBe('C.C. ••••••4050');
      expect(timeline.ticket.maskedDocument).not.toContain('102030');
      expect(timeline.statusHistory).toHaveLength(1);
      expect(timeline.statusHistory[0]?.actorName).toBe('Recepción Central');
      expect(timeline.calls).toHaveLength(1);
      expect(timeline.calls[0]?.callerName).toBe('Cajero 2');
    });

    it('closeTicket acredita dispatchesCount por actorUserId cuando pharmacist.findFirst y update están disponibles', async () => {
      const ticketInService = {
        id: 'ticket-ph-credit',
        publicId: '01JCREDIT001',
        publicCode: 'TUR-000901-GE',
        patientName: 'Paciente Crédito',
        status: TicketStatus.IN_SERVICE,
        cubicleId: 'cub-1',
        version: 1,
        createdAt: new Date(),
      };
      mockPrisma.ticket.findFirst.mockResolvedValueOnce(ticketInService);
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(ticketInService);
      mockPrisma.dispensationRecord.create.mockResolvedValueOnce({ id: 'disp-c1' });
      mockPrisma.pharmacist.findFirst = vi.fn().mockResolvedValueOnce({ id: 'ph-actor-1' });
      mockPrisma.pharmacist.update = vi.fn().mockResolvedValueOnce({ id: 'ph-actor-1' });
      mockCubiclesService.buildCubicleSnapshot.mockResolvedValueOnce({
        cubicle: { id: 'cub-1', code: 'CUB-01', displayName: 'Cubículo 01', status: CubicleStatus.AVAILABLE },
        activeTicket: null,
      });

      await ticketsService.closeTicket('01JCREDIT001', 'user-cashier-1', 'corr-cr-1', undefined, 1);

      expect(mockPrisma.pharmacist.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-cashier-1' },
        select: { id: true },
      });
      expect(mockPrisma.pharmacist.update).toHaveBeenCalledWith({
        where: { id: 'ph-actor-1' },
        data: { dispatchesCount: { increment: 1 } },
      });
      expect(mockPrisma.pharmacist.updateMany).not.toHaveBeenCalled();
    });

    it('getTicketHistory combina facilityId y search mediante AND y prioriza el operador real de la dispensación', async () => {
      const now = new Date();
      mockPrisma.ticket.count.mockResolvedValueOnce(1);
      mockPrisma.ticket.findMany.mockResolvedValueOnce([
        {
          id: 'tick-fac-1',
          publicId: '01JFAC001',
          publicCode: 'TUR-000950-GE',
          patientName: 'Camila Rojas',
          patientDocument: '1011223344',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.GENERAL,
          facilityId: 'fac-1',
          createdAt: now,
          calledAt: now,
          serviceStartedAt: now,
          closedAt: now,
          cubicle: { code: 'CUB-01', displayName: 'Cubículo 01', operatorName: 'Nuevo En Ventanilla', pharmacists: [], currentOperator: null },
          creator: { displayName: 'Recepción' },
          dispensation: {
            id: 'disp-h1',
            ticketId: 'tick-fac-1',
            cubicleId: 'cub-1',
            operatorUserId: 'usr-hist-1',
            resolution: DispensationResolution.TOTAL_DELIVERED,
            prescriptionCode: null,
            mipresNumber: null,
            itemsDeliveredCount: 1,
            itemsPendingCount: 0,
            pendingDetailsJson: null,
            deliveryAddress: null,
            deliveryPhone: null,
            deliveryDeadline: null,
            createdAt: now,
            operatorUser: {
              displayName: 'Cajero Histórico',
              pharmacistProfile: { fullName: 'Lic. Histórica Real' },
            },
          },
        },
      ]);

      const res = await ticketsService.getTicketHistory({
        facilityId: 'fac-1',
        search: 'Camila',
        page: 1,
        limit: 10,
      });

      const countWhere = mockPrisma.ticket.count.mock.calls[0][0].where;
      expect(countWhere.AND).toHaveLength(2);
      expect(countWhere.AND[0]).toEqual({
        OR: [{ facilityId: 'fac-1' }, { cubicle: { is: { facilityId: 'fac-1' } } }],
      });
      expect(countWhere.AND[1]).toHaveProperty('OR');
      expect(res.items[0]?.operatorName).toBe('Lic. Histórica Real');
      expect((res.items[0]?.dispensation as any)?.operatorUser).toBeUndefined();
    });
  });
});
