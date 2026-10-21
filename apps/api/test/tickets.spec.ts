import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PublicDisplayService } from '../src/modules/public-display/public-display.service';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { TicketStatus } from '@cubiora/shared';

describe('Fase 3a — Creación de Turnos (CP-01, CP-02, CP-03)', () => {
  let ticketsService: TicketsService;

  // Almacén simulado en memoria con concurrencia real y bloqueo secuencial atómico
  let sequenceValue: bigint;
  let createdTickets: Array<{
    id: string;
    publicId: string;
    sequenceNumber: bigint;
    publicCode: string;
    patientName: string;
    status: TicketStatus;
  }>;
  let statusHistory: Array<{
    id: string;
    ticketId: string;
    toStatus: TicketStatus;
  }>;
  let idempotencyStore: Map<string, any>;

  // Mutex para emular FOR UPDATE a nivel de motor en el mock
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
    idempotencyKey: {
      findUnique: vi.fn(async ({ where }) => {
        const key = `${where.uq_idempotency_key.actorUserId}:${where.uq_idempotency_key.operation}:${where.uq_idempotency_key.idempotencyKey}`;
        return idempotencyStore.get(key) || null;
      }),
    },
    $transaction: vi.fn(async (callback) => {
      const release = await acquireLock();
      try {
        const mockTx = {
          $queryRaw: vi.fn(async () => {
            return [{ next_value: sequenceValue }];
          }),
          $executeRaw: vi.fn(async () => {
            sequenceValue = sequenceValue + BigInt(1);
            return 1;
          }),
          ticket: {
            create: vi.fn(async ({ data }) => {
              createdTickets.push(data);
              return data;
            }),
          },
          ticketStatusHistory: {
            create: vi.fn(async ({ data }) => {
              statusHistory.push(data);
              return data;
            }),
          },
          idempotencyKey: {
            create: vi.fn(async ({ data }) => {
              const key = `${data.actorUserId}:${data.operation}:${data.idempotencyKey}`;
              idempotencyStore.set(key, data);
              return data;
            }),
          },
        };
        return await callback(mockTx);
      } finally {
        release();
      }
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    sequenceValue = BigInt(1);
    createdTickets = [];
    statusHistory = [];
    idempotencyStore = new Map();

    const mockPublicDisplay = {
      emitEvent: vi.fn(),
      getSnapshot: vi.fn(),
      getEventStream: vi.fn(),
    };

    const mockCubiclesService = {
      getOrCreateCubicleByCode: vi.fn(),
      buildCubicleSnapshot: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PublicDisplayService,
          useValue: mockPublicDisplay,
        },
        {
          provide: CubiclesService,
          useValue: mockCubiclesService,
        },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
  });

  describe('CP-01: Creación de Turno Nominal', () => {
    it('debe crear un turno con formato TUR-NNNNNN-XX, public_id ULID e historial atómico', async () => {
      const dto = {
        patientName: 'Juan Carlos Perez',
        patientDocument: 'CC12345678',
        priority: false,
      };

      const result = await ticketsService.createTicket(
        dto,
        'user_operator_reception',
        'corr-123-abc',
      );

      expect(result.statusCode).toBe(201);
      expect(result.data.publicCode).toBe('TUR-000001-GE');
      expect(result.data.sequenceNumber).toBe(1);
      expect(result.data.patientName).toBe('Juan Carlos Perez');
      expect(result.data.status).toBe(TicketStatus.PENDING);
      expect(result.data.publicId).toBeDefined();
      expect(result.data.publicId.length).toBe(26); // Longitud estándar ULID

      // Verificar que se insertó el ticket y el historial
      expect(createdTickets.length).toBe(1);
      expect(statusHistory.length).toBe(1);
      expect(statusHistory[0].ticketId).toBe(createdTickets[0].id);
      expect(statusHistory[0].toStatus).toBe(TicketStatus.PENDING);
    });

    it('debe asignar el sufijo PR cuando el turno es prioritario', async () => {
      const dto = {
        patientName: 'María Gomez',
        priority: true,
      };

      const result = await ticketsService.createTicket(
        dto,
        'user_operator_reception',
        'corr-456-def',
      );

      expect(result.data.publicCode).toBe('TUR-000001-PR');
    });
  });

  describe('CP-02: Idempotencia con Idempotency-Key', () => {
    it('debe retornar la misma respuesta cacheada sin avanzar la secuencia ni duplicar registros ante reintentos', async () => {
      const dto = {
        patientName: 'Roberto Gomez',
        patientDocument: 'CC98765432',
        priority: false,
      };
      const idempotencyKey = 'idem-unique-key-001';

      // Primer llamado
      const firstResponse = await ticketsService.createTicket(
        dto,
        'user_operator_reception',
        'corr-idem-1',
        idempotencyKey,
      );

      expect(firstResponse.statusCode).toBe(201);
      expect(firstResponse.data.publicCode).toBe('TUR-000001-GE');
      expect(createdTickets.length).toBe(1);

      // Segundo llamado idéntico con la misma clave
      const secondResponse = await ticketsService.createTicket(
        dto,
        'user_operator_reception',
        'corr-idem-2',
        idempotencyKey,
      );

      expect(secondResponse.statusCode).toBe(201);
      expect(secondResponse.data.publicCode).toBe('TUR-000001-GE');
      expect(secondResponse.data.publicId).toBe(firstResponse.data.publicId);
      // No debe haberse creado un nuevo ticket en la base de datos
      expect(createdTickets.length).toBe(1);
    });

    it('debe rechazar con 409 Conflict si la misma clave se usa con un cuerpo de petición diferente', async () => {
      const dto1 = { patientName: 'Ana Perez', priority: false };
      const dto2 = { patientName: 'Otro Paciente', priority: false };
      const idempotencyKey = 'idem-conflict-key';

      await ticketsService.createTicket(dto1, 'user1', 'corr-1', idempotencyKey);

      await expect(
        ticketsService.createTicket(dto2, 'user1', 'corr-2', idempotencyKey),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('CP-03: Concurrencia Masiva (100 creaciones concurrentes sin duplicados ni huecos)', () => {
    it('debe emitir 100 turnos correlativos del 1 al 100 sin huecos ni colisiones', async () => {
      const totalTickets = 100;
      const promises = Array.from({ length: totalTickets }, (_, index) => {
        return ticketsService.createTicket(
          {
            patientName: `Paciente Concurrente ${index + 1}`,
            priority: index % 2 === 0,
          },
          'user_operator_reception',
          `corr-conc-${index}`,
        );
      });

      const results = await Promise.all(promises);

      expect(results.length).toBe(totalTickets);
      expect(createdTickets.length).toBe(totalTickets);

      // Extraer y ordenar todos los números de secuencia emitidos
      const sequenceNumbers = results
        .map((r) => r.data.sequenceNumber)
        .sort((a, b) => a - b);

      // Validar que cada número del 1 al 100 exista exactamente una vez
      for (let i = 1; i <= totalTickets; i++) {
        expect(sequenceNumbers[i - 1]).toBe(i);
      }

      // Validar que no hay códigos duplicados
      const publicCodes = new Set(results.map((r) => r.data.publicCode));
      expect(publicCodes.size).toBe(totalTickets);
    });
  });
});
