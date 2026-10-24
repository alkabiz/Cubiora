import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useCashierMetrics,
  formatWaitTime,
  formatSla,
  type CashierOperativeSummary,
} from './use-cashier-metrics';

describe('useCashierMetrics hook y formateadores', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeMockResponse(data: CashierOperativeSummary) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data }),
    } as Response;
  }

  describe('Formateadores neutrales (cero invención de datos)', () => {
    it('formatWaitTime devuelve "—" para valores nulos y formatea minutos y segundos correctamente', () => {
      expect(formatWaitTime(null)).toBe('—');
      expect(formatWaitTime(0)).toBe('0s');
      expect(formatWaitTime(45)).toBe('45s');
      expect(formatWaitTime(60)).toBe('1m');
      expect(formatWaitTime(252)).toBe('4m 12s');
      expect(formatWaitTime(3600)).toBe('1h');
      expect(formatWaitTime(3661)).toBe('1h 1m 1s');
    });

    it('formatSla devuelve "—" para valores nulos y un decimal para porcentajes válidos', () => {
      expect(formatSla(null)).toBe('—');
      expect(formatSla(0)).toBe('0.0%');
      expect(formatSla(98.2)).toBe('98.2%');
      expect(formatSla(100)).toBe('100.0%');
      expect(formatSla(75.54)).toBe('75.5%');
    });
  });

  describe('Comportamiento del hook', () => {
    it('no realiza peticiones si enabled es false', () => {
      const fetchSpy = vi.fn();
      window.fetch = fetchSpy;

      const { result } = renderHook(() => useCashierMetrics(false));

      expect(result.current.status).toBe('idle');
      expect(result.current.data).toBeNull();
      expect(result.current.isStale).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('transiciona de loading a success con los datos devueltos por la API', async () => {
      const mockData: CashierOperativeSummary = {
        activeCount: 5,
        avgWaitSeconds: 180,
        slaCompliancePct: 92.5,
      };

      window.fetch = vi.fn(async () => makeMockResponse(mockData));

      const { result } = renderHook(() => useCashierMetrics(true));

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.isStale).toBe(false);
    });

    it('transiciona a error si la API falla en el primer llamado (sin datos previos)', async () => {
      window.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 500,
          json: async () => ({ code: 'INTERNAL_ERROR', message: 'Fallo interno' }),
        } as Response;
      });

      const { result } = renderHook(() => useCashierMetrics(true));

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isStale).toBe(false);
    });

    it('retiene el último dato confirmado y marca isStale:true ante caída de red y luego recupera', async () => {
      const initialData: CashierOperativeSummary = {
        activeCount: 8,
        avgWaitSeconds: 120,
        slaCompliancePct: 95.0,
      };

      let callCount = 0;
      window.fetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return makeMockResponse(initialData);
        }
        // Simular pérdida de conectividad (TypeError nativo de fetch)
        throw new TypeError('Failed to fetch');
      });

      const { result } = renderHook(() => useCashierMetrics(true));

      // 1. Primer llamado exitoso
      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });
      expect(result.current.data).toEqual(initialData);
      expect(result.current.isStale).toBe(false);

      // 2. Refresco que experimenta fallo de red
      await act(async () => {
        await result.current.refetch();
      });

      // Debe pasar a offline, conservar el dato y marcar isStale
      expect(result.current.status).toBe('offline');
      expect(result.current.data).toEqual(initialData);
      expect(result.current.isStale).toBe(true);

      // 3. La red se recupera con nuevas métricas
      const updatedData: CashierOperativeSummary = {
        activeCount: 10,
        avgWaitSeconds: 110,
        slaCompliancePct: 96.0,
      };
      window.fetch = vi.fn(async () => makeMockResponse(updatedData));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.status).toBe('success');
      expect(result.current.data).toEqual(updatedData);
      expect(result.current.isStale).toBe(false);
    });

    it('transiciona a error si el servidor responde 403 Forbidden', async () => {
      const initialData: CashierOperativeSummary = {
        activeCount: 3,
        avgWaitSeconds: 60,
        slaCompliancePct: 100,
      };

      let callCount = 0;
      window.fetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return makeMockResponse(initialData);
        }
        return {
          ok: false,
          status: 403,
          json: async () => ({ code: 'FORBIDDEN', message: 'Acceso denegado' }),
        } as Response;
      });

      const { result } = renderHook(() => useCashierMetrics(true));

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      // Refresco devuelve 403 -> debe pasar a error
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.data).toBeNull();
      expect(result.current.isStale).toBe(false);
    });
  });
});
