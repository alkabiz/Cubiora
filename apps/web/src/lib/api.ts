import { ApiError } from '@cubiora/shared';

const API_BASE = '/api/v1';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Cookies para sesión HTTP-only
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData: ApiError | null = null;
    try {
      errorData = await response.json();
    } catch {
      // Ignorar si el body no es JSON
    }

    throw new ApiClientError(
      errorData?.code || 'UNKNOWN_ERROR',
      errorData?.message || `Error en la petición: ${response.statusText}`,
      response.status,
      errorData?.details,
      errorData?.correlationId,
    );
  }

  // Si no hay contenido (ej: 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
