import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiClientError } from '../../lib/api';

export interface CashierOperativeSummary {
  activeCount: number;
  avgWaitSeconds: number | null;
  slaCompliancePct: number | null;
}

export type MetricsStatus = 'idle' | 'loading' | 'success' | 'error' | 'offline';

export interface UseCashierMetricsResult {
  status: MetricsStatus;
  data: CashierOperativeSummary | null;
  /** Último dato confirmado, conservado cuando se pierde la conexión. */
  staleData: CashierOperativeSummary | null;
  /** Si los datos mostrados son de una carga anterior (sin conexión). */
  isStale: boolean;
  /** Permite forzar un refresco bajo demanda. */
  refetch: () => Promise<void>;
}

export const DEFAULT_POLL_INTERVAL_MS = 30_000;

/**
 * Formatea segundos como "Xm Ys" o "—" si el valor es nulo.
 * Nunca inventa valores.
 */
export function formatWaitTime(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/**
 * Formatea un porcentaje con un decimal o "—" si es nulo.
 * Nunca inventa valores.
 */
export function formatSla(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct.toFixed(1)}%`;
}

/**
 * Hook que obtiene el resumen operativo desde la API.
 *
 * - Activo cuando el rol del usuario es CASHIER o ADMIN.
 * - Sondea cada 30 s por defecto.
 * - Conserva el último dato confirmado si se pierde la conexión.
 * - Devuelve `status: 'error'` si la API responde con un error (incluyendo 403).
 */
export function useCashierMetrics(
  enabled: boolean,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): UseCashierMetricsResult {
  const [status, setStatus] = useState<MetricsStatus>('idle');
  const [data, setData] = useState<CashierOperativeSummary | null>(null);
  const [staleData, setStaleData] = useState<CashierOperativeSummary | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Refs to track data inside async callbacks without stale closure
  const dataRef = useRef<CashierOperativeSummary | null>(null);
  const staleDataRef = useRef<CashierOperativeSummary | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!mountedRef.current) return;

    // Si no hay datos todavía, mostrar skeleton
    if (dataRef.current === null) {
      setStatus('loading');
    }

    try {
      const response = await apiClient<{ success: boolean; data: CashierOperativeSummary }>(
        '/cashier-metrics/operative-summary',
      );

      if (!mountedRef.current) return;

      dataRef.current = response.data;
      staleDataRef.current = response.data;
      setData(response.data);
      setStaleData(response.data);
      setIsStale(false);
      setStatus('success');
    } catch (err) {
      if (!mountedRef.current) return;

      const isOffline =
        err instanceof TypeError ||
        (err instanceof ApiClientError &&
          (err.statusCode === 0 || err.statusCode >= 500));

      if (isOffline && staleDataRef.current !== null) {
        // Sin conexión: conservar último dato confirmado, marcado como desactualizado
        setData(staleDataRef.current);
        setIsStale(true);
        setStatus('offline');
      } else {
        setData(null);
        setIsStale(false);
        setStatus('error');
      }
    }
  }, []); // sin dependencias de estado — usa refs internamente

  useEffect(() => {
    mountedRef.current = true;
    dataRef.current = null;
    staleDataRef.current = null;

    if (!enabled) {
      setStatus('idle');
      setData(null);
      setStaleData(null);
      setIsStale(false);
      return;
    }

    void fetchMetrics();

    timerRef.current = setInterval(() => {
      void fetchMetrics();
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [enabled, fetchMetrics, pollIntervalMs]);

  return { status, data, staleData, isStale, refetch: fetchMetrics };
}
