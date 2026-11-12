import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import { AuthProvider, useAuth } from './auth-context';
import { apiClient } from '../lib/api';
import { LoginPage } from '../pages/login-page';

const Harness: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-loading">{String(isLoading)}</span>
      <span data-testid="auth-user">{user?.username ?? 'none'}</span>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
      <button
        type="button"
        onClick={() => {
          void apiClient('/admin/users').catch(() => undefined);
        }}
      >
        Fetch Protected
      </button>
    </div>
  );
};

describe('AuthProvider & LoginPage — Limpieza de caché y carga segura (H-4)', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    sessionStorage.clear();
  });

  afterEach(() => {
    window.fetch = originalFetch;
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('limpia QueryClient y sessionStorage al ejecutar logout()', async () => {
    const client = new QueryClient();
    client.setQueryData(['admin', 'users'], [{ id: 'u1' }]);

    window.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              publicId: 'usr_1',
              username: 'admin',
              displayName: 'Admin',
              role: 'ADMIN',
              cubicleId: null,
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    });

    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('false');
      expect(screen.getByTestId('auth-user').textContent).toBe('admin');
    });

    expect(client.getQueryData(['admin', 'users'])).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-user').textContent).toBe('none');
    });
    expect(sessionStorage.getItem('cubiora_user')).toBeNull();
    expect(client.getQueryData(['admin', 'users'])).toBeUndefined();
  });

  it('limpia QueryClient y usuario automáticamente cuando una API responde 401', async () => {
    const client = new QueryClient();
    client.setQueryData(['admin', 'facilities'], [{ id: 'fac_1' }]);

    window.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              publicId: 'usr_1',
              username: 'admin',
              displayName: 'Admin',
              role: 'ADMIN',
              cubicleId: null,
            },
          }),
        };
      }
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ code: 'UNAUTHORIZED', message: 'Sesión revocada' }),
      };
    });

    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-user').textContent).toBe('admin');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fetch Protected' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-user').textContent).toBe('none');
    });
    expect(sessionStorage.getItem('cubiora_user')).toBeNull();
    expect(client.getQueryData(['admin', 'facilities'])).toBeUndefined();
  });

  it('LoginPage espera a isLoading=false antes de redirigir aunque exista usuario en sessionStorage', async () => {
    sessionStorage.setItem(
      'cubiora_user',
      JSON.stringify({
        publicId: 'usr_stale',
        username: 'admin',
        displayName: 'Stale Admin',
        role: 'ADMIN',
        cubicleId: null,
      }),
    );

    let resolveMe!: (value: unknown) => void;
    const mePromise = new Promise((resolve) => {
      resolveMe = resolve;
    });
    window.fetch = vi.fn().mockImplementation(() => mePromise);

    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <Theme accentColor="blue" grayColor="slate">
          <MemoryRouter initialEntries={['/login']}>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin" element={<div data-testid="admin-route">Admin</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </Theme>
      </QueryClientProvider>,
    );

    // Mientras /auth/me está pendiente, no debe redirigir prematuramente usando sessionStorage
    expect(screen.getByRole('heading', { name: 'Iniciar Sesión' })).toBeDefined();
    expect(screen.queryByTestId('admin-route')).toBeNull();

    resolveMe({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ code: 'UNAUTHORIZED', message: 'Expired' }),
    });

    await waitFor(() => {
      expect(sessionStorage.getItem('cubiora_user')).toBeNull();
    });
    expect(screen.queryByTestId('admin-route')).toBeNull();
  });
});

