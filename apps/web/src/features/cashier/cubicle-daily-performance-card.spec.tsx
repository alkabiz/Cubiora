import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';
import type { CubicleDailyPerformance } from '@cubiora/shared';
import { CubicleDailyPerformanceCard } from './cubicle-daily-performance-card';
import type { CubicleOutcome } from './types';
import {
  dailyPerformanceQueryKey,
  formatCompletedTickets,
  formatServiceDuration,
  formatTargetCompliance,
  formatTargetSeconds,
} from './use-cubicle-daily-performance';

function makePerformance(
  overrides: Partial<CubicleDailyPerformance> = {},
): CubicleDailyPerformance {
  return {
    cubicleCode: 'CUB-03',
    completedTickets: 4,
    averageServiceSeconds: 285,
    targetSeconds: 720,
    targetCompliancePercentage: 75,
    calculatedAt: '2026-10-24T15:00:00.000Z',
    ...overrides,
  };
}

function performanceResponse(data: CubicleDailyPerformance): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  } as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({ code: 'INTERNAL_ERROR', message: 'Fallo interno' }),
  } as Response;
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
}

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function cardTree(queryClient: QueryClient, outcome: CubicleOutcome | null = null) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme accentColor="teal" grayColor="slate">
        <CubicleDailyPerformanceCard cubicleCode="CUB-03" outcome={outcome} />
      </Theme>
    </QueryClientProvider>
  );
}

describe('CubicleDailyPerformanceCard', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    delete (window.navigator as unknown as { onLine?: boolean }).onLine;
    // React Query comparte un onlineManager global entre pruebas: restaurarlo
    // evita que las consultas de casos posteriores queden pausadas.
    window.dispatchEvent(new Event('online'));
    vi.restoreAllMocks();
  });

  it('muestra el skeleton mientras la consulta está en curso', async () => {
    let resolveRequest: ((response: Response) => void) | null = null;
    window.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(cardTree(createTestQueryClient()));

    const region = screen.getByRole('region', { name: 'Rendimiento del cubículo hoy' });
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Rendimiento del cubículo hoy' })).toBeDefined();

    await act(async () => {
      resolveRequest?.(performanceResponse(makePerformance()));
    });

    await screen.findByText('Turnos completados');
  });

  it('muestra las tres métricas reales y el objetivo configurado por backend', async () => {
    window.fetch = vi.fn(async () => performanceResponse(makePerformance()));

    render(cardTree(createTestQueryClient()));

    await screen.findByText('Turnos completados');

    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('Tiempo promedio por turno')).toBeDefined();
    expect(screen.getByText('4 min 45 s')).toBeDefined();
    expect(screen.getByText('Cumplimiento del objetivo operativo')).toBeDefined();
    expect(screen.getByText('75.0%')).toBeDefined();
    expect(screen.getByText('Objetivo ≤ 12 min')).toBeDefined();
    expect(screen.getByText('Jornada actual · CUB-03')).toBeDefined();
    expect(screen.queryByText(/SLA/)).toBeNull();

    expect(window.fetch).toHaveBeenCalledWith(
      '/api/v1/cubicles/CUB-03/daily-performance',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sin turnos completados muestra "—" y un mensaje neutral, sin inventar datos', async () => {
    window.fetch = vi.fn(async () =>
      performanceResponse(
        makePerformance({
          completedTickets: 0,
          averageServiceSeconds: null,
          targetCompliancePercentage: null,
        }),
      ),
    );

    render(cardTree(createTestQueryClient()));

    await screen.findByText('Aún no hay turnos completados');

    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('Objetivo ≤ 12 min')).toBeDefined();
  });

  it('muestra un mensaje de error cuando la API falla y no hay dato previo', async () => {
    window.fetch = vi.fn(async () => errorResponse(500));

    render(cardTree(createTestQueryClient()));

    await screen.findByText('No fue posible cargar el rendimiento del cubículo');
    expect(screen.queryByText('Turnos completados')).toBeNull();
  });

  it('marca los datos como desactualizados al perder la conexión sin esperar al sondeo', async () => {
    window.fetch = vi.fn(async () => performanceResponse(makePerformance()));

    render(cardTree(createTestQueryClient()));
    await screen.findByText('Turnos completados');

    setNavigatorOnline(false);

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByText('Datos desactualizados')).toBeDefined();
    });
    expect(screen.getByText('4')).toBeDefined();
  });

  it('conserva el último dato y muestra "Datos desactualizados" si falla la red', async () => {
    window.fetch = vi.fn(async () => performanceResponse(makePerformance()));
    const queryClient = createTestQueryClient();

    render(cardTree(queryClient));
    await screen.findByText('Turnos completados');

    window.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: dailyPerformanceQueryKey('CUB-03'),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Datos desactualizados')).toBeDefined();
    });
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('4 min 45 s')).toBeDefined();
  });

  it('invalida la consulta al confirmarse un cierre y refleja el nuevo turno', async () => {
    const fetchMock = vi
      .fn<typeof window.fetch>()
      .mockResolvedValueOnce(performanceResponse(makePerformance({ completedTickets: 3 })))
      .mockResolvedValueOnce(
        performanceResponse(
          makePerformance({
            completedTickets: 4,
            averageServiceSeconds: 300,
            targetCompliancePercentage: 75,
          }),
        ),
      );

    window.fetch = fetchMock;
    const queryClient = createTestQueryClient();

    const view = render(cardTree(queryClient));
    await screen.findByText('3');

    view.rerender(
      cardTree(queryClient, {
        type: 'CLOSED',
        finishedCode: 'TUR-000123-C3',
        hadNext: false,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('4')).toBeDefined();
      expect(screen.getByText('5 min')).toBeDefined();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Formateadores del rendimiento diario', () => {
  it('formatea duraciones legibles sin mostrar minutos desmedidos', () => {
    expect(formatServiceDuration(null)).toBe('—');
    expect(formatServiceDuration(0)).toBe('0 s');
    expect(formatServiceDuration(285)).toBe('4 min 45 s');
    expect(formatServiceDuration(3600)).toBe('1 h');
    expect(formatServiceDuration(3661)).toBe('1 h 1 min 1 s');
    expect(formatServiceDuration(163504)).toBe('45 h 25 min 4 s');
  });

  it('limita porcentajes a 0–100 con un decimal', () => {
    expect(formatTargetCompliance(null)).toBe('—');
    expect(formatTargetCompliance(-5)).toBe('0.0%');
    expect(formatTargetCompliance(66.66)).toBe('66.7%');
    expect(formatTargetCompliance(150)).toBe('100.0%');
  });

  it('no inventa cantidades ni objetivos inválidos', () => {
    expect(formatCompletedTickets(null)).toBe('—');
    expect(formatCompletedTickets(-1)).toBe('—');
    expect(formatCompletedTickets(7)).toBe('7');
    expect(formatTargetSeconds(null)).toBe('—');
    expect(formatTargetSeconds(0)).toBe('—');
    expect(formatTargetSeconds(720)).toBe('12 min');
  });
});
