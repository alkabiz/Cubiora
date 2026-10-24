import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CubicleDailyPerformance } from '@cubiora/shared';
import { ApiClientError, apiClient } from '../../lib/api';

/** Clave de consulta compartida para invalidar el rendimiento tras cerrar un turno. */
export function dailyPerformanceQueryKey(cubicleCode: string) {
  return ['cubicle-daily-performance', cubicleCode] as const;
}

/**
 * Formatea una duración en segundos de forma legible.
 * - 0 → "0 s"
 * - 285 → "4 min 45 s"
 * - 163504 → "45 h 25 min 4 s"
 * Devuelve "—" para valores ausentes o inválidos, sin inventar datos.
 */
export function formatServiceDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    const parts = [`${hours} h`];
    if (minutes > 0) parts.push(`${minutes} min`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds} s`);
    return parts.join(' ');
  }

  if (minutes > 0) {
    return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds} s` : `${minutes} min`;
  }

  return `${remainingSeconds} s`;
}

/**
 * Formatea un porcentaje con un máximo de una cifra decimal.
 * Siempre lo limita al rango [0, 100] y devuelve "—" cuando no hay dato.
 */
export function formatTargetCompliance(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  const clamped = Math.min(100, Math.max(0, value));
  return `${clamped.toFixed(1)}%`;
}

/** Formatea la cantidad real de turnos completados. */
export function formatCompletedTickets(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return '—';
  }
  return String(Math.trunc(value));
}

/** Objetivo operativo legible, derivado del valor configurado en backend. */
export function formatTargetSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  return formatServiceDuration(seconds);
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ApiClientError && (error.statusCode === 0 || error.statusCode >= 500))
  );
}

function subscribeToConnectivity(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);

  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getConnectivitySnapshot(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function getServerConnectivitySnapshot(): boolean {
  return true;
}

async function fetchDailyPerformance(cubicleCode: string): Promise<CubicleDailyPerformance> {
  const response = await apiClient<{ success: boolean; data: CubicleDailyPerformance }>(
    `/cubicles/${encodeURIComponent(cubicleCode)}/daily-performance`,
  );

  const data = response.data;
  if (
    !data ||
    typeof data.cubicleCode !== 'string' ||
    typeof data.completedTickets !== 'number' ||
    typeof data.targetSeconds !== 'number' ||
    typeof data.calculatedAt !== 'string'
  ) {
    throw new Error('Respuesta inválida del rendimiento del cubículo.');
  }

  return data;
}

export interface UseCubicleDailyPerformanceResult {
  data: CubicleDailyPerformance | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** Error de red o navegador sin conexión después de tener un dato confirmado. */
  isStale: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/**
 * Consulta el rendimiento diario del cubículo.
 *
 * - No refresca cada segundo: solo consulta al montar y cada 60 s.
 * - Tras cerrar un turno, la CARD invalida esta consulta explícitamente.
 * - Conserva el último dato confirmado si falla la red.
 */
export function useCubicleDailyPerformance(
  cubicleCode: string,
  enabled = true,
): UseCubicleDailyPerformanceResult {
  const query = useQuery({
    queryKey: dailyPerformanceQueryKey(cubicleCode),
    queryFn: () => fetchDailyPerformance(cubicleCode),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const hasData = query.data !== undefined;
  const online = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getServerConnectivitySnapshot,
  );
  const isStale = hasData && (!online || (query.isError && isNetworkFailure(query.error)));

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    isStale,
    error: query.error,
    refetch: query.refetch,
  };
}

export { ApiClientError };
