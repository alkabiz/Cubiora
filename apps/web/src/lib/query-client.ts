import { useContext } from 'react';
import { QueryClient, QueryClientContext } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 segundos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Devuelve el QueryClient activo del árbol (si existe QueryClientProvider) o
 * el cliente singleton por defecto, evitando errores en pruebas unitarias sin Provider.
 */
export function useResolvedQueryClient(): QueryClient {
  const contextClient = useContext(QueryClientContext);
  return contextClient ?? queryClient;
}

export const adminQueryKeys = {
  all: ['admin'] as const,
  pharmacists: (filters?: {
    search?: string;
    facilityId?: string;
    operationalRole?: string;
    status?: string;
  }) => ['admin', 'pharmacists', filters ?? {}] as const,
  facilities: () => ['admin', 'facilities'] as const,
  cubicles: (facilityId?: string) => ['admin', 'cubicles', facilityId ?? 'primary'] as const,
  users: () => ['admin', 'users'] as const,
};
