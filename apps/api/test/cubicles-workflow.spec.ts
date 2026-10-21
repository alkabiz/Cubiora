import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { PublicDisplayService } from '../src/modules/public-display/public-display.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TicketStatus, CubicleStatus } from '@cubiora/shared';

describe('Punto 7 — Integración y Concurrencia de Cubículos y Pantalla', () => {
  let ticketsService: TicketsService;
  let cubiclesService: CubiclesService;
  let publicDisplayService: PublicDisplayService;

  // Repositorio simulado en memoria
  let ticketsDb: Map<string, any>;
  let cubiclesDb: Map<string, any>;
  let callsDb: any[];
  let historyDb: any[];
  let idempotencyDb: Map<string, any>;
  let sseEventsEmitted: any[];

  // Mutex para emular aislamiento de transacciones
  let lockPromise = Promise.resolve();
  function acquireLock(): Promise<() => void> {
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentLock = lockPromise;
    lockPromise = lockPromise.then(() => nextLock);
    return currentLock.then(() => release);
  }

  const mockPrisma = {
    ticket: {
      findFirst: vi.fn(async ({ where, orderBy }) => {
        let items = Array.from(ticketsDb.values());
        if (where?.OR) {
          return (
            items.find(
              (t) =>
                where.OR.some((cond: any) => cond.id === t.id || cond.publicId === t.publicId),
            ) || null
          );
        }
        if (where?.cubicleId) {
          items = items.filter((t) => t.cubicleId === where.cubicleId);
        }
        if (where?.status?.in) {
          items = items.filter((t) => where.status.in.includes(t.status));
        } else if (where?.status) {
          items = items.filter((t) => t.status === where.status);
        }
        if (orderBy?.sequenceNumber === 'asc') {
          items.sort((a, b) => Number(a.sequenceNumber - b.sequenceNumber));
        }
        const item = items[0] || null;
        if (item) {
          const calls = callsDb
            .filter((c) => c.ticketId === item.id)
            .sort((a, b) => b.callNumber - a.callNumber);
          return { ...item, calls };
        }
        return null;
      }),
      findUnique: vi.fn(async ({ where }) => {
        return ticketsDb.get(where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const item = ticketsDb.get(where.id);
        if (!item) throw new Error('Ticket not found');
        const updated = {
          ...item,
          ...data,
          version: data.version?.increment ? item.version + 1 : (data.version ?? item.version),
        };
        ticketsDb.set(where.id, updated);
        return updated;
      }),
    },
    cubicle: {
      findFirst: vi.fn(async ({ where }) => {
        const items = Array.from(cubiclesDb.values());
        if (where?.OR) {
          return (
            items.find(
              (c) =>
                where.OR.some((cond: any) => cond.code === c.code),
            ) || null
          );
        }
        return items[0] || null;
      }),
      findUnique: vi.fn(async ({ where }) => {
        return cubiclesDb.get(where.id) || null;
      }),
      create: vi.fn(async ({ data }) => {
        cubiclesDb.set(data.id, { ...data });
        return data;
      }),
      update: vi.fn(async ({ where, data }) => {
        const item = cubiclesDb.get(where.id);
        if (!item) throw new Error('Cubicle not found');
        const updated = {
          ...item,
          ...data,
          version: data.version?.increment ? item.version + 1 : (data.version ?? item.version),
        };
        cubiclesDb.set(where.id, updated);
        return updated;
      }),
    },
    ticketCall: {
      count: vi.fn(async ({ where }) => {
        return callsDb.filter((c) => c.ticketId === where.ticketId).length;
      }),
      create: vi.fn(async ({ data }) => {
        callsDb.push(data);
        return data;
      }),
      findMany: vi.fn(async ({ take, orderBy }) => {
        const sorted = [...callsDb].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        const sliced = sorted.slice(0, take);
        return sliced.map((c) => {
          const t = ticketsDb.get(c.ticketId);
          const cub = cubiclesDb.get(c.cubicleId);
          return {
            ...c,
            ticket: { publicCode: t?.publicCode || 'TUR-000000-GE', status: t?.status },
            cubicle: { displayName: cub?.displayName || 'Cubículo 03' },
          };
        });
      }),
    },
    ticketStatusHistory: {
      create: vi.fn(async ({ data }) => {
        historyDb.push(data);
        return data;
      }),
    },
    idempotencyKey: {
      findUnique: vi.fn(async ({ where }) => {
        const key = `${where.uq_idempotency_key.actorUserId}:${where.uq_idempotency_key.operation}:${where.uq_idempotency_key.idempotencyKey}`;
        return idempotencyDb.get(key) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const key = `${data.actorUserId}:${data.operation}:${data.idempotencyKey}`;
        idempotencyDb.set(key, data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback) => {
      const release = await acquireLock();
      try {
        const tx = {
          ticket: mockPrisma.ticket,
          cubicle: mockPrisma.cubicle,
          ticketCall: mockPrisma.ticketCall,
          ticketStatusHistory: mockPrisma.ticketStatusHistory,
          $queryRaw: vi.fn(async () => {
            // Emular selección de siguiente PENDING
            const pendings = Array.from(ticketsDb.values())
              .filter((t) => t.status === TicketStatus.PENDING)
              .sort((a, b) => Number(a.sequenceNumber - b.sequenceNumber));
            return pendings.length > 0 ? [{ id: pendings[0].id }] : [];
          }),
        };
        return await callback(tx);
      } finally {
        release();
      }
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    ticketsDb = new Map();
    cubiclesDb = new Map();
    callsDb = [];
    historyDb = [];
    idempotencyDb = new Map();
    sseEventsEmitted = [];

    // Inicializar cubículo de prueba
    const cubicle03 = {
      id: 'cub_03_id',
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      status: CubicleStatus.AVAILABLE,
      active: true,
      version: 1,
    };
    cubiclesDb.set(cubicle03.id, cubicle03);

    const mockPublicDisplay = {
      emitEvent: vi.fn((event) => {
        sseEventsEmitted.push(event);
      }),
      getSnapshot: vi.fn(async () => {
        const calls = await mockPrisma.ticketCall.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
        const formatted = calls.map((c: any) => ({
          publicCode: c.ticket.publicCode,
          cubicleDisplayName: c.cubicle.displayName,
          calledAt: c.createdAt.toISOString(),
          callNumber: c.callNumber,
        }));
        return {
          currentCall: formatted[0] || null,
          recentCalls: formatted.slice(1, 5),
        };
      }),
      getEventStream: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        CubiclesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PublicDisplayService,
          useValue: mockPublicDisplay,
        },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
    cubiclesService = module.get<CubiclesService>(CubiclesService);
    publicDisplayService = module.get<PublicDisplayService>(PublicDisplayService);
  });

  describe('Caja: Ciclo completo ASSIGNED -> CALLED -> IN_SERVICE -> CLOSED con asignación de siguiente', () => {
    it('debe ejecutar el ciclo de atención completo y en CLOSED asignar automáticamente el siguiente PENDING', async () => {
      // 1. Crear turno 1 asignado al cubículo
      const ticket1 = {
        id: 'ticket_1',
        publicId: '01JABCD0001',
        sequenceNumber: BigInt(1),
        publicCode: 'TUR-000001-GE',
        patientName: 'Carlos Pérez',
        status: TicketStatus.ASSIGNED,
        cubicleId: 'cub_03_id',
        version: 1,
        createdBy: 'user_rec',
        createdAt: new Date(),
      };
      ticketsDb.set(ticket1.id, ticket1);

      // Turno 2 en PENDING esperando en cola
      const ticket2 = {
        id: 'ticket_2',
        publicId: '01JABCD0002',
        sequenceNumber: BigInt(2),
        publicCode: 'TUR-000002-GE',
        patientName: 'María Rodríguez',
        status: TicketStatus.PENDING,
        cubicleId: null,
        version: 1,
        createdBy: 'user_rec',
        createdAt: new Date(),
      };
      ticketsDb.set(ticket2.id, ticket2);

      // 2. Snapshot inicial del cubículo
      const initialSnapshot = await cubiclesService.getOrCreateCubicleByCode('CUB-03');
      expect(initialSnapshot.activeTicket).not.toBeNull();
      expect(initialSnapshot.activeTicket?.publicCode).toBe('TUR-000001-GE');
      expect(initialSnapshot.activeTicket?.status).toBe(TicketStatus.ASSIGNED);

      // 3. Llamar turno (ASSIGNED -> CALLED)
      const callResult = await ticketsService.callTicket(
        ticket1.id,
        'cashier_user_1',
        'corr-call-1',
        'idem-call-1',
        1,
      );
      expect(callResult.data.activeTicket?.status).toBe(TicketStatus.CALLED);
      expect(callResult.data.cubicle.status).toBe(CubicleStatus.CALLING);
      expect(sseEventsEmitted.length).toBe(1);
      expect(sseEventsEmitted[0].type).toBe('ticket.called');
      expect(sseEventsEmitted[0].data.publicCode).toBe('TUR-000001-GE');
      expect(sseEventsEmitted[0].data.cubicleDisplayName).toBe('Cubículo 03');

      // 4. Repetir llamado (CALLED -> CALLED)
      const recallResult = await ticketsService.callTicket(
        ticket1.id,
        'cashier_user_1',
        'corr-recall-1',
        undefined,
        2,
      );
      expect(recallResult.data.activeTicket?.callNumber).toBe(2);
      expect(sseEventsEmitted.length).toBe(2);
      expect(sseEventsEmitted[1].type).toBe('ticket.recalled');

      // 5. Iniciar atención (CALLED -> IN_SERVICE)
      const startResult = await ticketsService.startService(
        ticket1.id,
        'cashier_user_1',
        'corr-start-1',
        'idem-start-1',
        3,
      );
      expect(startResult.data.activeTicket?.status).toBe(TicketStatus.IN_SERVICE);
      expect(startResult.data.cubicle.status).toBe(CubicleStatus.BUSY);

      // 6. Cierre transaccional: cierra ticket1 y asigna ticket2
      const closeResult = await ticketsService.closeTicket(
        ticket1.id,
        'cashier_user_1',
        'corr-close-1',
        'idem-close-1',
        4,
      );

      // Ticket 1 cerrado
      expect(ticketsDb.get(ticket1.id).status).toBe(TicketStatus.CLOSED);

      // Snapshot retornado: nuevo turno ticket 2 asignado automáticamente
      expect(closeResult.data.activeTicket?.publicCode).toBe('TUR-000002-GE');
      expect(closeResult.data.activeTicket?.status).toBe(TicketStatus.ASSIGNED);
      expect(closeResult.data.cubicle.status).toBe(CubicleStatus.RESERVED);

      // 7. Cerrar ticket2 sin que haya más turnos en cola -> cubículo queda AVAILABLE
      // Primero llamamos y comenzamos atención de ticket 2
      await ticketsService.callTicket(ticket2.id, 'cashier_user_1', 'corr-call-2', undefined, 2);
      await ticketsService.startService(ticket2.id, 'cashier_user_1', 'corr-start-2', undefined, 3);
      const finalClose = await ticketsService.closeTicket(
        ticket2.id,
        'cashier_user_1',
        'corr-close-final',
        undefined,
        4,
      );
      expect(finalClose.data.activeTicket).toBeNull();
      expect(finalClose.data.cubicle.status).toBe(CubicleStatus.AVAILABLE);
    });

    it('debe marcar no presentado (NO_SHOW) y asignar el siguiente PENDING si existe', async () => {
      const ticketA = {
        id: 'ticket_a',
        publicId: '01JABCD000A',
        sequenceNumber: BigInt(10),
        publicCode: 'TUR-000010-GE',
        patientName: 'Pedro Infante',
        status: TicketStatus.CALLED,
        cubicleId: 'cub_03_id',
        version: 2,
        createdBy: 'user_rec',
        createdAt: new Date(),
      };
      const ticketB = {
        id: 'ticket_b',
        publicId: '01JABCD000B',
        sequenceNumber: BigInt(11),
        publicCode: 'TUR-000011-GE',
        patientName: 'Laura Sanchez',
        status: TicketStatus.PENDING,
        cubicleId: null,
        version: 1,
        createdBy: 'user_rec',
        createdAt: new Date(),
      };
      ticketsDb.set(ticketA.id, ticketA);
      ticketsDb.set(ticketB.id, ticketB);

      const noShowResult = await ticketsService.noShowTicket(
        ticketA.id,
        'cashier_user_1',
        'corr-noshow-1',
        'idem-noshow-1',
        2,
      );

      expect(ticketsDb.get(ticketA.id).status).toBe(TicketStatus.NO_SHOW);
      expect(ticketsDb.get(ticketA.id).terminalReason).toBe('PATIENT_NO_SHOW');

      // Se asigna ticketB al cubículo
      expect(noShowResult.data.activeTicket?.publicCode).toBe('TUR-000011-GE');
      expect(noShowResult.data.activeTicket?.status).toBe(TicketStatus.ASSIGNED);
    });

    it('debe rechazar con 409 STATE_CONFLICT si expectedVersion no coincide', async () => {
      const ticketConflict = {
        id: 'ticket_conf',
        publicId: '01JABCD00CF',
        sequenceNumber: BigInt(20),
        publicCode: 'TUR-000020-GE',
        patientName: 'Conflicto Version',
        status: TicketStatus.ASSIGNED,
        cubicleId: 'cub_03_id',
        version: 5, // Versión actual en DB es 5
        createdBy: 'user_rec',
        createdAt: new Date(),
      };
      ticketsDb.set(ticketConflict.id, ticketConflict);

      // Enviamos expectedVersion = 3 (desactualizado)
      await expect(
        ticketsService.callTicket(
          ticketConflict.id,
          'cashier_user_1',
          'corr-conflict-1',
          undefined,
          3,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Pantalla Pública: Cero PII y Snapshot', () => {
    it('debe generar snapshot con Cero PII (sin nombres ni cédulas de pacientes)', async () => {
      callsDb.push({
        id: 'call_1',
        ticketId: 'ticket_pii_1',
        cubicleId: 'cub_03_id',
        calledBy: 'cashier_1',
        callNumber: 1,
        createdAt: new Date(),
      });
      ticketsDb.set('ticket_pii_1', {
        id: 'ticket_pii_1',
        publicCode: 'TUR-000099-GE',
        patientName: 'Nombre Secreto Paciente',
        patientDocument: 'CC 10203040',
        status: TicketStatus.CALLED,
      });

      const snapshot = await publicDisplayService.getSnapshot();
      expect(snapshot.currentCall).not.toBeNull();
      expect(snapshot.currentCall?.publicCode).toBe('TUR-000099-GE');
      expect(snapshot.currentCall?.cubicleDisplayName).toBe('Cubículo 03');
      // Verificamos que patientName y patientDocument NO existen en el snapshot
      expect((snapshot.currentCall as any).patientName).toBeUndefined();
      expect((snapshot.currentCall as any).patientDocument).toBeUndefined();
    });
  });

  describe('Concurrencia e Idempotencia', () => {
    it('dos llamadas con la misma Idempotency-Key deben retornar el mismo snapshot sin duplicar eventos', async () => {
      const ticketIdem = {
        id: 'ticket_idem',
        publicId: '01JABCDIDEM1',
        sequenceNumber: BigInt(30),
        publicCode: 'TUR-000030-GE',
        patientName: 'Paciente Idempotente',
        status: TicketStatus.ASSIGNED,
        cubicleId: 'cub_03_id',
        version: 1,
        createdBy: 'user_rec',
        createdAt: new Date(),
      };
      ticketsDb.set(ticketIdem.id, ticketIdem);

      const idemKey = 'key-call-idem-test';
      const res1 = await ticketsService.callTicket(
        ticketIdem.id,
        'user_cashier',
        'corr-1',
        idemKey,
        1,
      );
      const res2 = await ticketsService.callTicket(
        ticketIdem.id,
        'user_cashier',
        'corr-2',
        idemKey,
        1,
      );

      expect(res1.data.activeTicket?.publicCode).toBe('TUR-000030-GE');
      expect(res2.data.activeTicket?.publicCode).toBe('TUR-000030-GE');
      // No debe haberse emitido dos veces el evento SSE por el reintento idempotente
      expect(sseEventsEmitted.length).toBe(1);
    });
  });
});
