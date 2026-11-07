import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OperationalTelemetryService } from '../src/modules/operational-telemetry/operational-telemetry.service';
import { OperationalTelemetryGateway } from '../src/modules/operational-telemetry/operational-telemetry.gateway';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { QueueCategory, CubicleStatus, UserRole } from '@cubiora/shared';

describe('OperationalTelemetryService · Analítica SQL Nativa y Detección de Cuellos de Botella (Fase 4)', () => {
  let telemetryService: OperationalTelemetryService;
  let gateway: OperationalTelemetryGateway;
  let mockPrisma: any;
  let mockCubiclesService: any;

  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', 'super_secret_session_key_min_32_characters_12345');
    vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173');
    vi.stubEnv('CUBICLE_DAILY_TARGET_SECONDS', '720');

    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { awt_seconds: 480, tmm_seconds: 320 },
      ]),
      cubicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'cub-01',
            code: 'CUB-01',
            displayName: 'Cubículo 01',
            status: CubicleStatus.AVAILABLE,
            tickets: [],
            currentOperator: {
              displayName: 'Farm. Carlos Soto',
              role: UserRole.CASHIER,
              active: true,
            },
          },
          {
            id: 'cub-02',
            code: 'CUB-02',
            displayName: 'Cubículo 02',
            status: CubicleStatus.BUSY,
            tickets: [
              {
                publicCode: 'TUR-000001-GE',
                status: 'IN_SERVICE',
                serviceStartedAt: new Date(Date.now() - 300 * 1000),
                calledAt: new Date(Date.now() - 350 * 1000),
                assignedAt: new Date(Date.now() - 400 * 1000),
              },
            ],
            currentOperator: {
              displayName: 'Lic. Ana Rivas',
              role: UserRole.CASHIER,
              active: true,
            },
          },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
      ticket: {
        findMany: vi.fn().mockImplementation((args: any) => {
          // PENDING tickets query
          if (args?.where?.status === 'PENDING') {
            return Promise.resolve([
              {
                id: 'tick-hc-1',
                publicCode: 'TUR-000010-HC',
                queueCategory: QueueCategory.HIGH_COST,
                createdAt: new Date(Date.now() - 1000 * 1000), // > 16 min (excede 900s)
                sequenceNumber: 1,
              },
              {
                id: 'tick-hc-2',
                publicCode: 'TUR-000011-HC',
                queueCategory: QueueCategory.HIGH_COST,
                createdAt: new Date(Date.now() - 950 * 1000),
                sequenceNumber: 2,
              },
              {
                id: 'tick-hc-3',
                publicCode: 'TUR-000012-HC',
                queueCategory: QueueCategory.HIGH_COST,
                createdAt: new Date(Date.now() - 920 * 1000),
                sequenceNumber: 3,
              },
            ]);
          }
          // CLOSED tickets query
          if (args?.where?.status === 'CLOSED') {
            return Promise.resolve([
              {
                serviceStartedAt: new Date(Date.now() - 600 * 1000),
                closedAt: new Date(Date.now() - 100 * 1000),
              },
            ]);
          }
          // Hourly tickets query
          return Promise.resolve([]);
        }),
        count: vi.fn().mockImplementation((args: any) => {
          if (args?.where?.status === 'CLOSED') return Promise.resolve(15);
          if (args?.where?.status === 'NO_SHOW') return Promise.resolve(1);
          return Promise.resolve(0);
        }),
      },
    };

    mockCubiclesService = {
      listCubicles: vi.fn().mockResolvedValue([]),
    };

    gateway = new OperationalTelemetryGateway(
      mockPrisma,
      mockCubiclesService,
      new (class MockWsGatewayUtil {
        extractTokenFromHandshake() {
          return 'valid-token';
        }
      })() as any,
    );

    telemetryService = new OperationalTelemetryService(
      mockPrisma,
      gateway,
      mockCubiclesService,
    );
  });

  it('debe calcular AWT y TMM utilizando la agregación SQL nativa de PostgreSQL', async () => {
    const snapshot = await telemetryService.buildSnapshot();

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(snapshot.kpis.averageWaitSeconds).toBe(480);
    expect(snapshot.kpis.averageServiceSeconds).toBe(320);
  });

  it('debe degradar limpiamente a cálculo en memoria si $queryRaw falla', async () => {
    mockPrisma.$queryRaw = vi.fn().mockRejectedValue(new Error('Syntax or connection error'));

    const snapshot = await telemetryService.buildSnapshot();

    // No debe fallar el snapshot
    expect(snapshot).toBeDefined();
    expect(snapshot.kpis.averageServiceSeconds).toBe(500); // (600 - 100)
    expect(snapshot.kpis.averageWaitSeconds).toBeGreaterThan(900);
  });

  it('debe detectar cuello de botella en Alto Costo / MIPRES y sugerir reasignar cubículo disponible', async () => {
    const snapshot = await telemetryService.buildSnapshot();

    expect(snapshot.bottleneckRecommendation).toBeDefined();
    expect(snapshot.bottleneckRecommendation?.detected).toBe(true);
    expect(snapshot.bottleneckRecommendation?.congestedCategory).toBe('HIGH_COST');
    expect(snapshot.bottleneckRecommendation?.suggestedIdleCubicleCode).toBe('CUB-01');
    expect(snapshot.bottleneckRecommendation?.suggestedAction).toContain('Alto Costo');
    expect(snapshot.bottleneckRecommendation?.message).toContain('Cuello de botella detectado en Alto Costo / MIPRES');
  });

  it('no debe emitir recomendación de cuello de botella si no hay cubículos en ocio para reasignar', async () => {
    // Todos ocupados
    mockPrisma.cubicle.findMany = vi.fn().mockResolvedValue([
      {
        id: 'cub-01',
        code: 'CUB-01',
        displayName: 'Cubículo 01',
        status: CubicleStatus.BUSY,
        tickets: [{ publicCode: 'TUR-01', status: 'IN_SERVICE', serviceStartedAt: new Date() }],
        currentOperator: null,
      },
    ]);

    const snapshot = await telemetryService.buildSnapshot();
    expect(snapshot.bottleneckRecommendation).toBeNull();
  });
});

