import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PublicDisplayService } from '../src/modules/public-display/public-display.service';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { DispensationResolution, QueueCategory, TicketStatus } from '@cubiora/shared';

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
  });
});
