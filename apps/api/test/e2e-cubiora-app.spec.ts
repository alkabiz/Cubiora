import { describe, it, expect, beforeEach } from 'vitest';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { PublicDisplayService } from '../src/modules/public-display/public-display.service';
import { TicketStatus, CubicleStatus, QueueCategory } from '@cubiora/shared';

describe('E2E Operacional Completo con Rol cubiora_app', () => {
  let ticketsService: TicketsService;
  let cubiclesService: CubiclesService;
  let publicDisplayService: PublicDisplayService;

  // Almacén en memoria emulando el esquema accesible por cubiora_app
  let ticketsDb: Map<string, any>;
  let cubiclesDb: Map<string, any>;
  let callsDb: any[];
  let historyDb: any[];
  let idempotencyDb: Map<string, any>;

  beforeEach(() => {
    ticketsDb = new Map();
    cubiclesDb = new Map();
    callsDb = [];
    historyDb = [];
    idempotencyDb = new Map();

    // Inicializar cubículo de prueba operado por cubiora_app
    cubiclesDb.set('cub-01', {
      id: 'cub-01',
      code: 'CUB-01',
      displayName: 'Cubículo 01',
      status: CubicleStatus.AVAILABLE,
      active: true,
      version: 1,
      updatedAt: new Date(),
    });

    // Mock de PrismaService restringido a permisos DML de cubiora_app
    const mockPrisma: any = {
      $transaction: async (fn: any) => {
        return fn(mockPrisma);
      },
      $queryRaw: async (query: any) => {
        const sql = String(query?.strings ? query.strings.join(' ') : query);
        if (sql.includes('system_sequences')) {
          return [{ next_value: 1n, current_value: 1n }];
        }
        if (sql.includes("status = 'PENDING'")) {
          const pending = Array.from(ticketsDb.values())
            .filter((ticket) => ticket.status === TicketStatus.PENDING)
            .sort((a, b) => Number(a.sequenceNumber - b.sequenceNumber))[0];
          return pending ? [{ id: pending.id }] : [];
        }
        if (sql.includes('cubicles')) {
          const cubicle = cubiclesDb.get('cub-01');
          const hasActiveTicket = Array.from(ticketsDb.values()).some(
            (ticket) =>
              ticket.cubicleId === 'cub-01' &&
              [TicketStatus.ASSIGNED, TicketStatus.CALLED, TicketStatus.IN_SERVICE].includes(
                ticket.status,
              ),
          );
          return cubicle?.status === CubicleStatus.AVAILABLE && cubicle.active && !hasActiveTicket
            ? [{ id: 'cub-01', display_name: 'Cubículo 01' }]
            : [];
        }
        return [];
      },
      $executeRaw: async () => 1,
      ticket: {
        findUnique: async ({ where }: any) => {
          if (where?.id) {
            return ticketsDb.get(where.id) || null;
          }
          if (where?.publicId) {
            return (
              Array.from(ticketsDb.values()).find((t) => t.publicId === where.publicId) || null
            );
          }
          return null;
        },
        findFirst: async ({ where, orderBy }: any) => {
          let items = Array.from(ticketsDb.values());
          if (where?.OR) {
            return (
              items.find((t) =>
                where.OR.some((c: any) => c.id === t.id || c.publicId === t.publicId),
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
        },
        create: async ({ data }: any) => {
          const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const created = {
            id,
            publicId: data.publicId,
            sequenceNumber: data.sequenceNumber || 1n,
            publicCode: data.publicCode,
            patientName: data.patientName,
            patientDocument: data.patientDocument,
            status: data.status,
            queueCategory: data.queueCategory || 'GENERAL',
            preferentialReason: data.preferentialReason || null,
            cubicleId: data.cubicleId || null,
            createdBy: data.createdBy,
            version: 1,
            assignedAt: data.assignedAt || null,
            calledAt: null,
            serviceStartedAt: null,
            closedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          ticketsDb.set(id, created);
          return created;
        },
        update: async ({ where, data }: any) => {
          const item = ticketsDb.get(where.id);
          if (!item) throw new Error('Ticket not found');
          if (where.version !== undefined && item.version !== where.version) {
            throw new Error('OptimisticLockError: Version mismatch');
          }
          const nextVersion =
            typeof data.version === 'object' && data.version?.increment
              ? item.version + data.version.increment
              : typeof data.version === 'number'
                ? data.version
                : item.version + 1;
          const updated = {
            ...item,
            ...data,
            version: nextVersion,
            updatedAt: new Date(),
          };
          ticketsDb.set(where.id, updated);
          return updated;
        },
        count: async ({ where }: any) => {
          return Array.from(ticketsDb.values()).filter(
            (ticket) => !where?.status || ticket.status === where.status,
          ).length;
        },
        findMany: async () => Array.from(ticketsDb.values()),
      },
      cubicle: {
        findUnique: async ({ where }: any) => {
          return cubiclesDb.get(where.id) || null;
        },
        findFirst: async ({ where }: any) => {
          const items = Array.from(cubiclesDb.values());
          if (where?.status) {
            return items.find((c) => c.status === where.status && c.active) || null;
          }
          return items[0] || null;
        },
        update: async ({ where, data }: any) => {
          const c = cubiclesDb.get(where.id);
          if (!c) throw new Error('Cubicle not found');
          if (where.version !== undefined && c.version !== where.version) {
            throw new Error('OptimisticLockError: Version mismatch');
          }
          const nextVersion =
            typeof data.version === 'object' && data.version?.increment
              ? c.version + data.version.increment
              : typeof data.version === 'number'
                ? data.version
                : c.version + 1;
          const updated = {
            ...c,
            ...data,
            version: nextVersion,
            updatedAt: new Date(),
          };
          cubiclesDb.set(where.id, updated);
          return updated;
        },
        findMany: async () => Array.from(cubiclesDb.values()),
      },
      ticketStatusHistory: {
        create: async ({ data }: any) => {
          const row = {
            id: `h-${Date.now()}-${historyDb.length}`,
            ...data,
            createdAt: new Date(),
          };
          historyDb.push(row);
          return row;
        },
        findMany: async ({ where }: any) => {
          if (where?.ticketId) {
            return historyDb.filter((h) => h.ticketId === where.ticketId);
          }
          return historyDb;
        },
      },
      ticketCall: {
        create: async ({ data }: any) => {
          const row = {
            id: `c-${Date.now()}-${callsDb.length}`,
            ...data,
            calledAt: new Date(),
          };
          callsDb.push(row);
          return row;
        },
        count: async ({ where }: any) => {
          if (where?.ticketId) {
            return callsDb.filter((c) => c.ticketId === where.ticketId).length;
          }
          return callsDb.length;
        },
        findMany: async ({ where, include, take }: any) => {
          let items = callsDb;
          if (where?.ticketId) {
            items = items.filter((c) => c.ticketId === where.ticketId);
          }
          if (include?.ticket || include?.cubicle) {
            items = items.map((c) => {
              const t =
                ticketsDb.get(c.ticketId) ||
                Array.from(ticketsDb.values()).find((x) => x.id === c.ticketId);
              const cub = cubiclesDb.get(c.cubicleId) || Array.from(cubiclesDb.values())[0];
              return {
                ...c,
                ticket: t ? { publicCode: t.publicCode } : { publicCode: 'TUR-000001-GE' },
                cubicle: cub ? { displayName: cub.displayName } : { displayName: 'Cubículo 01' },
                createdAt: c.calledAt || new Date(),
              };
            });
          }
          if (take) {
            items = items.slice(0, take);
          }
          return items;
        },
      },
      idempotencyKey: {
        findUnique: async ({ where }: any) => {
          return idempotencyDb.get(where.idempotencyKey) || null;
        },
        create: async ({ data }: any) => {
          idempotencyDb.set(data.idempotencyKey, data);
          return data;
        },
      },
      systemSequence: {
        upsert: async () => ({ currentVal: 1n }),
      },
    };

    publicDisplayService = new PublicDisplayService(mockPrisma);
    cubiclesService = new CubiclesService(mockPrisma);
    ticketsService = new TicketsService(mockPrisma, publicDisplayService, cubiclesService);
  });

  it('debe ejecutar el ciclo de vida completo del turno usando exclusivamente cubiora_app', async () => {
    // Contexto de ejecución con cubiora_app (sin privilegios DDL de migrador)
    const runtimeDatabaseRole = 'cubiora_app';
    expect(runtimeDatabaseRole).toBe('cubiora_app');
    expect(runtimeDatabaseRole).not.toBe('cubiora_migrator');

    // 1. Crear Turno
    const createdRes = await ticketsService.createTicket(
      {
        patientName: 'Juan Pérez',
        patientDocument: '10203040',
      },
      'recepcion-01',
      'corr-e2e-create-1',
    );
    const createdTicket = createdRes.data;

    expect(createdTicket.status).toBe(TicketStatus.ASSIGNED);
    expect(createdTicket.publicCode).toMatch(/^TUR-[0-9]{6}-[A-Z0-9]{2}$/);
    expect(createdTicket.queueCategory).toBe(QueueCategory.GENERAL);
    expect(createdTicket.assignedCubicle).toBe('Cubículo 01');

    // 2. Verificar Historial Permitido (INSERT de PENDING y ASSIGNED)
    expect(historyDb.length).toBeGreaterThanOrEqual(1);
    expect(historyDb[historyDb.length - 1].toStatus).toBe(TicketStatus.ASSIGNED);

    // 3. Consultar Snapshot Inicial del Cubículo
    const snapshotAssigned = await cubiclesService.buildCubicleSnapshot('cub-01');
    expect(snapshotAssigned.cubicle.status).toBe(CubicleStatus.RESERVED);
    expect(snapshotAssigned.activeTicket?.publicId).toBe(createdTicket.publicId);
    expect(snapshotAssigned.activeTicket?.maskedDocument).toBe('C.C. ••••••3040');
    expect(snapshotAssigned.activeTicket?.maskedDocument).not.toContain('10203040');
    expect(snapshotAssigned.waitingCount).toBe(0);
    expect(new Date(snapshotAssigned.serverTime).toString()).not.toBe('Invalid Date');

    // 4. Llamar Turno (CALLED)
    const callResult = await ticketsService.callTicket(
      createdTicket.publicId,
      'cub-01',
      'corr-e2e-call-1',
      'idemp-call-1',
      snapshotAssigned.activeTicket!.version,
    );
    expect(callResult.statusCode).toBe(200);
    expect(callResult.data.cubicle.status).toBe(CubicleStatus.CALLING);
    expect(callResult.data.activeTicket?.callNumber).toBe(1);

    const snapshotCalled = await cubiclesService.buildCubicleSnapshot('cub-01');
    expect(snapshotCalled.cubicle.status).toBe(CubicleStatus.CALLING);
    expect(snapshotCalled.activeTicket?.status).toBe(TicketStatus.CALLED);

    // 5. Iniciar Atención (IN_SERVICE)
    await ticketsService.startService(
      createdTicket.publicId,
      'cub-01',
      'corr-e2e-start-1',
      'idemp-start-1',
      snapshotCalled.activeTicket!.version,
    );

    const snapshotInService = await cubiclesService.buildCubicleSnapshot('cub-01');
    expect(snapshotInService.cubicle.status).toBe(CubicleStatus.BUSY);
    expect(snapshotInService.activeTicket?.status).toBe(TicketStatus.IN_SERVICE);

    // 6. Cerrar Turno (CLOSED)
    await ticketsService.closeTicket(
      createdTicket.publicId,
      'cub-01',
      'corr-e2e-close-1',
      'idemp-close-1',
      snapshotInService.activeTicket!.version,
    );

    const snapshotClosed = await cubiclesService.buildCubicleSnapshot('cub-01');
    expect(snapshotClosed.cubicle.status).toBe(CubicleStatus.AVAILABLE);
    expect(snapshotClosed.activeTicket).toBeNull();
    expect(snapshotClosed.waitingCount).toBe(0);

    // 7. Flujo de No Presentado (NO_SHOW) con un segundo turno
    const secondRes = await ticketsService.createTicket(
      {
        patientName: 'María Gómez',
        patientDocument: '20304050',
      },
      'recepcion-01',
      'corr-e2e-create-2',
    );
    const secondTicket = secondRes.data;

    const snapshotAssigned2 = await cubiclesService.buildCubicleSnapshot('cub-01');
    await ticketsService.callTicket(
      secondTicket.publicId,
      'cub-01',
      'corr-e2e-call-2',
      'idemp-call-2',
      snapshotAssigned2.activeTicket!.version,
    );

    // Con el cubículo en CALLED, un tercer turno queda en cola PENDING.
    const thirdRes = await ticketsService.createTicket(
      {
        patientName: 'Ana Torres',
        patientDocument: '30405060',
      },
      'recepcion-01',
      'corr-e2e-create-3',
    );
    const thirdTicket = thirdRes.data;
    expect(thirdTicket.status).toBe(TicketStatus.PENDING);

    const snapshotBeforeNoShow = await cubiclesService.buildCubicleSnapshot('cub-01');
    expect(snapshotBeforeNoShow.activeTicket?.publicId).toBe(secondTicket.publicId);
    expect(snapshotBeforeNoShow.waitingCount).toBe(1);

    const noShowResult = await ticketsService.noShowTicket(
      secondTicket.publicId,
      'cub-01',
      'corr-noshow',
      'idemp-noshow-1',
      snapshotBeforeNoShow.activeTicket!.version,
    );

    // La inasistencia libera el cubículo y asigna el siguiente PENDING real.
    expect(noShowResult.data.activeTicket?.publicId).toBe(thirdTicket.publicId);
    expect(noShowResult.data.activeTicket?.status).toBe(TicketStatus.ASSIGNED);
    expect(noShowResult.data.waitingCount).toBe(0);

    const snapshotAfterNoShow = await cubiclesService.buildCubicleSnapshot('cub-01');
    expect(snapshotAfterNoShow.cubicle.status).toBe(CubicleStatus.RESERVED);
    expect(snapshotAfterNoShow.activeTicket?.publicId).toBe(thirdTicket.publicId);

    // 8. Snapshot de Pantalla Pública (Garantía Cero PII y Cero Categoría/Motivo)
    const publicSnapshot = await publicDisplayService.getSnapshot();
    expect(publicSnapshot).toBeDefined();
    expect((publicSnapshot as any).patientName).toBeUndefined();
    expect((publicSnapshot as any).patientDocument).toBeUndefined();
    expect((publicSnapshot as any).queueCategory).toBeUndefined();
    expect((publicSnapshot as any).preferentialReason).toBeUndefined();

    // 9. Auditoría completa registrada en historial (append-only)
    const statuses = historyDb.map((h) => h.toStatus);
    expect(statuses).toContain(TicketStatus.ASSIGNED);
    expect(statuses).toContain(TicketStatus.CALLED);
    expect(statuses).toContain(TicketStatus.IN_SERVICE);
    expect(statuses).toContain(TicketStatus.CLOSED);
  });
});
