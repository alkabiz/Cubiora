import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OperationalTelemetryService } from '../src/modules/operational-telemetry/operational-telemetry.service';
import { OperationalTelemetryGateway } from '../src/modules/operational-telemetry/operational-telemetry.gateway';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionTokenUtil } from '../src/modules/auth/session-token.util';
import { UserRole, TELEMETRY_EVENTS } from '@cubiora/shared';

describe('Validación de Telemetría Operativa WebSocket (OperationalTelemetry)', () => {
  let telemetryService: OperationalTelemetryService;
  let gateway: OperationalTelemetryGateway;
  let mockPrisma: any;
  let mockCubiclesService: any;
  let mockPublicDisplayService: any;
  const SESSION_SECRET = 'super_secret_session_key_min_32_characters_12345';

  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', SESSION_SECRET);
    vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173');
    vi.stubEnv('CUBICLE_DAILY_TARGET_SECONDS', '720'); // 12 minutos

    mockPrisma = {
      facility: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'fac-01',
          code: 'SEDE-CEN-01',
          name: 'Sede Central',
        }),
      },
      cubicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'cub-01',
            code: 'CUB-01',
            displayName: 'Cubículo 01',
            status: 'BUSY',
            tickets: [
              {
                publicCode: 'TUR-000122-F4',
                status: 'IN_SERVICE',
                serviceStartedAt: new Date(Date.now() - 300 * 1000), // 5 min (nominal)
                calledAt: new Date(Date.now() - 360 * 1000),
                assignedAt: new Date(Date.now() - 400 * 1000),
              },
            ],
            currentOperator: {
              displayName: 'Lic. M. Arismendi',
              role: UserRole.CASHIER,
              active: true,
            },
          },
          {
            id: 'cub-02',
            code: 'CUB-02',
            displayName: 'Cubículo 02',
            status: 'BUSY',
            tickets: [
              {
                publicCode: 'TUR-000120-B9',
                status: 'IN_SERVICE',
                serviceStartedAt: new Date(Date.now() - 850 * 1000), // > 14 min (SLA Excedido)
                calledAt: new Date(Date.now() - 900 * 1000),
                assignedAt: new Date(Date.now() - 950 * 1000),
              },
            ],
            currentOperator: {
              displayName: 'Farm. J. Duarte',
              role: UserRole.CASHIER,
              active: true,
            },
          },
          {
            id: 'cub-03',
            code: 'CUB-03',
            displayName: 'Cubículo 03',
            status: 'CALLING',
            tickets: [
              {
                publicCode: 'TUR-000123-A7',
                status: 'CALLED',
                serviceStartedAt: null,
                calledAt: new Date(Date.now() - 150 * 1000),
                assignedAt: new Date(Date.now() - 180 * 1000),
              },
            ],
            currentOperator: {
              displayName: 'Lic. R. Mendoza',
              role: UserRole.CASHIER,
              active: true,
            },
          },
          {
            id: 'cub-04',
            code: 'CUB-04',
            displayName: 'Cubículo 04',
            status: 'AVAILABLE',
            tickets: [],
            currentOperator: {
              displayName: 'Farm. S. Quintero',
              role: UserRole.CASHIER,
              active: true,
            },
          },
          {
            id: 'cub-05',
            code: 'CUB-05',
            displayName: 'Cubículo 05',
            status: 'INACTIVE',
            tickets: [],
            currentOperator: null,
          },
        ]),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'cub-02') {
            return Promise.resolve({
              id: 'cub-02',
              code: 'CUB-02',
              displayName: 'Cubículo 02',
              status: 'BUSY',
              tickets: [
                {
                  publicCode: 'TUR-000120-B9',
                  status: 'IN_SERVICE',
                  serviceStartedAt: new Date(Date.now() - 850 * 1000),
                  calledAt: new Date(Date.now() - 900 * 1000),
                  assignedAt: new Date(Date.now() - 950 * 1000),
                },
              ],
              currentOperator: {
                displayName: 'Farm. J. Duarte',
                role: UserRole.CASHIER,
                active: true,
              },
            });
          }
          return Promise.resolve(null);
        }),
      },
      ticket: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          if (where.status === 'PENDING') {
            return Promise.resolve([
              {
                publicCode: 'TUR-000124-PR',
                queueCategory: 'PREFERENTIAL',
                createdAt: new Date(Date.now() - 600 * 1000),
              },
              {
                publicCode: 'TUR-000125-GE',
                queueCategory: 'GENERAL',
                createdAt: new Date(Date.now() - 400 * 1000),
              },
            ]);
          }
          if (where.status === 'CLOSED') {
            return Promise.resolve([
              {
                serviceStartedAt: new Date(Date.now() - 3600 * 1000),
                closedAt: new Date(Date.now() - 3200 * 1000), // 400s (dentro de SLA)
                cubicleId: 'cub-01',
              },
            ]);
          }
          return Promise.resolve([]);
        }),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    mockCubiclesService = {};
    mockPublicDisplayService = {
      emitNotice: vi.fn().mockReturnValue({
        message: 'Test',
        severity: 'info',
        issuedAtIso: new Date().toISOString(),
      }),
    };

    telemetryService = new OperationalTelemetryService(
      mockPrisma as PrismaService,
      mockCubiclesService as CubiclesService,
    );

    gateway = new OperationalTelemetryGateway(telemetryService, mockPublicDisplayService);
  });

  it('1. Construye snapshot inicial completo con detección automática de umbral SLA', async () => {
    const snapshot = await telemetryService.buildSnapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot.facilityCode).toBe('SEDE-CEN-01');
    expect(snapshot.facilityName).toBe('Sede Central');
    expect(snapshot.slaThresholdSeconds).toBe(720);
    expect(snapshot.cubicles).toHaveLength(5);

    // Cubículo 01 dentro de umbral -> ATENDIENDO
    const cub1 = snapshot.cubicles.find((c) => c.cubicleCode === 'CUB-01');
    expect(cub1?.visualStatus).toBe('ATENDIENDO');
    expect(cub1?.isSlaExceeded).toBe(false);

    // Cubículo 02 superando 12 min (850s) -> SLA_EXCEDIDO dinámico
    const cub2 = snapshot.cubicles.find((c) => c.cubicleCode === 'CUB-02');
    expect(cub2?.visualStatus).toBe('SLA_EXCEDIDO');
    expect(cub2?.isSlaExceeded).toBe(true);

    // Cubículo 03 en estado CALLING -> LLAMANDO
    const cub3 = snapshot.cubicles.find((c) => c.cubicleCode === 'CUB-03');
    expect(cub3?.visualStatus).toBe('LLAMANDO');

    // Cubículo 04 en AVAILABLE -> DISPONIBLE
    const cub4 = snapshot.cubicles.find((c) => c.cubicleCode === 'CUB-04');
    expect(cub4?.visualStatus).toBe('DISPONIBLE');

    // Cubículo 05 en INACTIVE -> INACTIVO
    const cub5 = snapshot.cubicles.find((c) => c.cubicleCode === 'CUB-05');
    expect(cub5?.visualStatus).toBe('INACTIVO');

    // Diagnóstico operativo SLA superior activo
    expect(snapshot.slaAlert.isActive).toBe(true);
    expect(snapshot.slaAlert.worstCubicleCode).toBe('CUB-02');
    expect(snapshot.slaAlert.affectedTicketCode).toBe('TUR-000120-B9');

    // Cola centralizada
    expect(snapshot.queue).toHaveLength(2);
    expect(snapshot.queue[0]?.ticketPublicCode).toBe('TUR-000124-PR');
  });

  it('2. Emite eventos reactivos al gateway a través de los streams observables', async () => {
    const emittedCubicleEvents: any[] = [];
    const emittedQueueEvents: any[] = [];

    telemetryService.onCubicleUpdate$.subscribe((event) => {
      emittedCubicleEvents.push(event);
    });

    telemetryService.onQueueUpdate$.subscribe((event) => {
      emittedQueueEvents.push(event);
    });

    // Simula disparo desde TicketsService
    await telemetryService.emitCubicleUpdate('cub-02');
    await telemetryService.emitQueueUpdate();

    expect(emittedCubicleEvents).toHaveLength(1);
    expect(emittedCubicleEvents[0].cubicle.cubicleCode).toBe('CUB-02');
    expect(emittedCubicleEvents[0].cubicle.visualStatus).toBe('SLA_EXCEDIDO');

    expect(emittedQueueEvents).toHaveLength(1);
    expect(emittedQueueEvents[0].queue).toHaveLength(2);
  });

  it('3. Gateway valida autenticación y rechaza usuarios no autorizados', async () => {
    const mockSocket: any = {
      id: 'sock-123',
      handshake: {
        headers: {},
        auth: {},
      },
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    // Sin token -> rechaza
    await gateway.handleConnection(mockSocket);
    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    expect(mockSocket.emit).toHaveBeenCalledWith('exception', expect.objectContaining({ code: 'AUTH_REQUIRED' }));

    // Con token pero rol RECEPTION -> rechaza
    const receptionToken = SessionTokenUtil.sign(
      {
        sub: 'usr-1',
        publicId: 'rec-1',
        username: 'reception',
        displayName: 'Recepción',
        role: UserRole.RECEPTION,
        cubicleId: null,
      },
      SESSION_SECRET,
    );
    mockSocket.handshake.auth = { token: receptionToken };
    mockSocket.disconnect.mockClear();
    mockSocket.emit.mockClear();

    await gateway.handleConnection(mockSocket);
    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);

    // Con token ADMIN -> conecta y emite snapshot
    const adminToken = SessionTokenUtil.sign(
      {
        sub: 'usr-admin',
        publicId: 'adm-1',
        username: 'admin',
        displayName: 'Administrador',
        role: UserRole.ADMIN,
        cubicleId: null,
      },
      SESSION_SECRET,
    );
    mockSocket.handshake.auth = { token: adminToken };
    mockSocket.disconnect.mockClear();
    mockSocket.emit.mockClear();

    await gateway.handleConnection(mockSocket);
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith(TELEMETRY_EVENTS.SNAPSHOT, expect.any(Object));
  });

  it('4. Gateway responde a ping con pong intacto para medición de latencia RTT', () => {
    const mockSocket: any = {
      emit: vi.fn(),
    };
    const now = Date.now();

    gateway.handlePing(mockSocket, { clientSentAt: now });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      TELEMETRY_EVENTS.PONG,
      expect.objectContaining({
        clientSentAt: now,
        serverTime: expect.any(String),
      }),
    );
  });

  it('5. Gateway reenvía Aviso General validado a PublicDisplayService y omite mensajes vacíos', () => {
    const serverEmit = vi.fn();
    (gateway as any).server = { emit: serverEmit };

    const adminSocket: any = {
      user: { role: UserRole.ADMIN, displayName: 'Director Técnico' },
    };

    gateway.handleBroadcastNotice(adminSocket, { message: '   ', severity: 'info' });
    expect(mockPublicDisplayService.emitNotice).not.toHaveBeenCalled();

    gateway.handleBroadcastNotice(adminSocket, {
      message: '  Mantener orden en fila preferencial  ',
      severity: 'warning',
    });

    expect(mockPublicDisplayService.emitNotice).toHaveBeenCalledWith(
      'Mantener orden en fila preferencial',
      'warning',
    );
    expect(serverEmit).toHaveBeenCalledWith(
      'admin:notice',
      expect.objectContaining({
        message: 'Mantener orden en fila preferencial',
        severity: 'warning',
        sentBy: 'Director Técnico',
      }),
    );
  });
});

