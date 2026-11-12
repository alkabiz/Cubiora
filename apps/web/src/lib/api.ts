import { ApiError } from '@cubiora/shared';

const API_BASE = '/api/v1';

type UnauthorizedHandler = () => void;
const unauthorizedListeners = new Set<UnauthorizedHandler>();

export function onUnauthorizedResponse(listener: UnauthorizedHandler): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized(): void {
  for (const listener of unauthorizedListeners) {
    try {
      listener();
    } catch {
      // Ignorar errores en listeners de limpieza de sesión
    }
  }
}

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

    if (
      response.status === 401 &&
      !endpoint.startsWith('/auth/login') &&
      !endpoint.startsWith('/auth/logout')
    ) {
      notifyUnauthorized();
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

export interface WrappedApiResponse<T> {
  success?: boolean;
  data?: T;
}

/**
 * Extrae `data` desde respuestas envueltas `{ success: true, data }` o devuelve el payload directo.
 */
export function unwrapApiData<T>(payload: WrappedApiResponse<T> | T): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as WrappedApiResponse<T>).data !== undefined
  ) {
    return (payload as WrappedApiResponse<T>).data as T;
  }
  return payload as T;
}
