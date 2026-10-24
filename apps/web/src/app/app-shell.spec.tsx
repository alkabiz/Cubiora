import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Theme } from '@radix-ui/themes';
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router-dom';
import { CubicleStatus, TicketStatus } from '@cubiora/shared';
import { AppShell } from './app-shell';
import { AppMain } from './app-main';
import { PageHeader } from './page-header';
import { appRoutes } from './router';
import { CashierPage } from '../pages/cashier-page';
import { ReceptionPage } from '../pages/reception-page';
import { AdminCubiclesPage } from '../pages/admin-cubicles-page';
import { AdminHistoryPage } from '../pages/admin-history-page';

const authMock = vi.hoisted(() => ({
  current: {
    user: null as {
      publicId: string;
      username: string;
      displayName: string;
      role: 'RECEPTION' | 'CASHIER' | 'ADMIN';
      cubicleId: string | null;
    } | null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
  },
}));

vi.mock('../context/auth-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/auth-context')>();
  return {
    ...actual,
    useAuth: () => authMock.current,
  };
});

function makeUser(role: 'RECEPTION' | 'CASHIER' | 'ADMIN') {
  const names: Record<typeof role, string> = {
    RECEPTION: 'Rosa Mendoza',
    CASHIER: 'Carlos Ramírez',
    ADMIN: 'Ana Torres',
  };

  return {
    publicId: `usr_${role.toLowerCase()}`,
    username: role.toLowerCase(),
    displayName: names[role],
    role,
    cubicleId: role === 'CASHIER' ? 'cub_03' : null,
  };
}

function setUser(role: 'RECEPTION' | 'CASHIER' | 'ADMIN' | null) {
  authMock.current.user = role ? makeUser(role) : null;
}

function makeTicket(status: TicketStatus) {
  const now = Date.now();

  return {
    id: 'ticket_124',
    publicId: '01JTICK124',
    publicCode: 'TUR-000124-C3',
    patientName: 'Carlos Pérez',
    maskedDocument: 'C.C. ••••••8212',
    status,
    version: 1,
    assignedAt: new Date(now - 300_000).toISOString(),
    calledAt: status === TicketStatus.CALLED ? new Date(now - 120_000).toISOString() : null,
    serviceStartedAt: null,
    callNumber: 1,
  };
}

function makeAvailableSnapshot() {
  return {
    cubicle: {
      id: 'cub_03',
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      status: CubicleStatus.AVAILABLE,
      version: 1,
    },
    activeTicket: null,
    waitingCount: 0,
    serverTime: new Date().toISOString(),
  };
}

function makeAssignedSnapshot() {
  return {
    cubicle: {
      id: 'cub_03',
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      status: CubicleStatus.RESERVED,
      version: 1,
    },
    activeTicket: makeTicket(TicketStatus.ASSIGNED),
    waitingCount: 0,
    serverTime: new Date().toISOString(),
  };
}

function okResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  } as Response;
}

function unauthorizedResponse() {
  return {
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ success: false, code: 'UNAUTHORIZED', message: 'Sesión expirada' }),
  } as Response;
}

function renderShellAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { path: 'recepcion', element: <ReceptionPage /> },
          { path: 'cajero', element: <CashierPage /> },
          { path: 'admin/cubiculos', element: <AdminCubiclesPage /> },
          { path: 'admin/historial', element: <AdminHistoryPage /> },
        ],
      },
      { path: '/login', element: <div>Pantalla de acceso</div> },
    ],
    { initialEntries: [path] },
  );

  return render(
    <Theme accentColor="teal" grayColor="slate">
      <RouterProvider router={router} />
    </Theme>,
  );
}

function getMainNavigation() {
  return screen.getByRole('navigation', { name: 'Navegación principal' });
}

async function openUserMenu(displayName: string) {
  const trigger = screen.getByRole('button', {
    name: new RegExp(`Abrir menú de usuario de ${displayName}`, 'i'),
  });

  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);

  return screen.findByRole('menu');
}

describe('Shell de aplicación Cubiora', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    authMock.current.logout = vi.fn(async () => undefined);
    authMock.current.login = vi.fn();
    authMock.current.refreshUser = vi.fn(async () => undefined);
    setUser('RECEPTION');
    sessionStorage.clear();

    (globalThis as unknown as { EventSource: unknown }).EventSource = vi.fn(
      () => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onerror: null,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('RECEPTION solo ve Generar turno y la marca como página actual', async () => {
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/recepcion');

    const nav = getMainNavigation();
    expect(
      within(nav).getByRole('link', { name: 'Generar turno' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(within(nav).queryByRole('link', { name: 'Mi cubículo' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Cubículos' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Historial' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Generar turno' })).toBeDefined();

    await waitFor(() =>
      expect(screen.getByText('SCR-REC-001 · Recepción')).toBeDefined(),
    );
  });

  it('CASHIER solo ve Mi cubículo y reporta el estado operativo', async () => {
    setUser('CASHIER');
    window.fetch = vi.fn(async () => okResponse(makeAvailableSnapshot()));
    renderShellAt('/cajero');

    const nav = getMainNavigation();
    expect(
      within(nav).getByRole('link', { name: 'Mi cubículo' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(within(nav).queryByRole('link', { name: 'Generar turno' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Cubículos' })).toBeNull();

    await waitFor(() => expect(screen.getByText('Disponible')).toBeDefined());
    expect(screen.getByRole('status', { name: /Estado de conexión: En línea/i })).toBeDefined();
  });

  it('ADMIN ve Cubículos e Historial, sin módulos operativos', () => {
    setUser('ADMIN');
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/admin/cubiculos');

    const nav = getMainNavigation();
    expect(
      within(nav).getByRole('link', { name: 'Cubículos' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Historial' })).toBeDefined();
    expect(within(nav).queryByRole('link', { name: 'Generar turno' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Mi cubículo' })).toBeNull();

    expect(screen.getByText('SCR-ADM-002 · Administración')).toBeDefined();
  });

  it('el elemento activo cambia con la ruta y el shell conserva la navegación accesible', () => {
    setUser('ADMIN');
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/admin/historial');

    const nav = getMainNavigation();
    expect(
      within(nav).getByRole('link', { name: 'Historial' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      within(nav).getByRole('link', { name: 'Cubículos' }).getAttribute('aria-current'),
    ).toBeNull();
    expect(screen.getByText('SCR-ADM-003 · Auditoría básica')).toBeDefined();
  });

  it('la sidebar se colapsa conservando nombres accesibles y tooltips', () => {
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/recepcion');

    fireEvent.click(screen.getByRole('button', { name: 'Contraer menú lateral' }));

    const shell = document.querySelector('.app-shell');
    expect(shell?.getAttribute('data-sidebar-collapsed')).toBe('true');

    const collapsedLink = screen.getByRole('link', { name: 'Generar turno' });
    expect(collapsedLink.getAttribute('aria-label')).toBe('Generar turno');
    expect(collapsedLink.getAttribute('aria-current')).toBe('page');
    expect(collapsedLink.classList.contains('app-sidebar-link')).toBe(true);
    expect(collapsedLink.classList.contains('is-active')).toBe(true);
    expect(screen.getByRole('button', { name: 'Expandir menú lateral' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir menú lateral' }));
    expect(shell?.getAttribute('data-sidebar-collapsed')).toBe('false');
  });

  it('muestra el badge de conexión y reacciona a los eventos reales del navegador', async () => {
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/recepcion');

    expect(screen.getByRole('status', { name: /Estado de conexión: En línea/i })).toBeDefined();

    window.dispatchEvent(new Event('offline'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: /Estado de conexión: Sin conexión/i }),
      ).toBeDefined(),
    );

    window.dispatchEvent(new Event('online'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: /Estado de conexión: En línea/i }),
      ).toBeDefined(),
    );
  });

  it('incluye un enlace para saltar al contenido principal', () => {
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/recepcion');

    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido principal' });
    expect(skipLink.getAttribute('href')).toBe('#main-content');

    const main = document.querySelector('main#main-content');
    expect(main).not.toBeNull();
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });

  it('muestra el nombre y rol del usuario en el menú de usuario', async () => {
    setUser('CASHIER');
    window.fetch = vi.fn(async () => okResponse(makeAvailableSnapshot()));
    renderShellAt('/cajero');

    expect(screen.getByText('Carlos Ramírez')).toBeDefined();
    expect(screen.getByText('Operador de cubículo')).toBeDefined();

    const menu = await openUserMenu('Carlos Ramírez');
    expect(within(menu).getByRole('menuitem', { name: /Cerrar sesión/i })).toBeDefined();
  });

  it('bloquea el cierre de sesión durante un turno activo', async () => {
    setUser('CASHIER');
    window.fetch = vi.fn(async () => okResponse(makeAssignedSnapshot()));
    renderShellAt('/cajero');

    await waitFor(() => expect(screen.getByText('TUR-000124-C3')).toBeDefined());

    const menu = await openUserMenu('Carlos Ramírez');
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Cerrar sesión/i }));

    expect(await screen.findByText('Turno activo en progreso')).toBeDefined();
    expect(
      screen.getByText(
        /No puedes cerrar sesión durante un turno activo\. Finaliza la atención antes de salir\./i,
      ),
    ).toBeDefined();
    expect(authMock.current.logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al turno' }));
    await waitFor(() =>
      expect(screen.queryByText('Turno activo en progreso')).toBeNull(),
    );
  });

  it('permite cerrar sesión cuando no hay turno activo', async () => {
    setUser('CASHIER');
    window.fetch = vi.fn(async () => okResponse(makeAvailableSnapshot()));
    renderShellAt('/cajero');

    await waitFor(() => expect(screen.getByText('Disponible')).toBeDefined());

    const menu = await openUserMenu('Carlos Ramírez');
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Cerrar sesión/i }));

    await waitFor(() => expect(authMock.current.logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Pantalla de acceso')).toBeDefined();
  });

  it('abre el Drawer móvil, atrapa el foco y lo cierra con Escape', async () => {
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/recepcion');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }));

    const dialog = await screen.findByRole('dialog');
    const mobileNav = within(dialog).getByRole('navigation', {
      name: 'Navegación principal móvil',
    });
    expect(within(mobileNav).getByRole('link', { name: 'Generar turno' })).toBeDefined();

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('cierra el Drawer móvil al elegir una ruta', async () => {
    window.fetch = vi.fn(async () => unauthorizedResponse());
    renderShellAt('/recepcion');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }));
    const dialog = await screen.findByRole('dialog');
    const mobileNav = within(dialog).getByRole('navigation', {
      name: 'Navegación principal móvil',
    });

    fireEvent.click(within(mobileNav).getByRole('link', { name: 'Generar turno' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('renderiza PageHeader con código, sección, título, descripción y acción', () => {
    render(
      <Theme accentColor="teal" grayColor="slate">
        <PageHeader
          code="SCR-TEST-001"
          section="Pruebas"
          title="Título de prueba"
          description="Descripción de prueba."
          action={<button type="button">Acción contextual</button>}
        />
      </Theme>,
    );

    expect(screen.getByText('SCR-TEST-001 · Pruebas')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Título de prueba' })).toBeDefined();
    expect(screen.getByText('Descripción de prueba.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Acción contextual' })).toBeDefined();
  });

  it('AppMain expone un único landmark principal', () => {
    render(
      <Theme accentColor="teal" grayColor="slate">
        <AppMain header={<PageHeader title="Contenido" />}>
          <p>Contenido de prueba</p>
        </AppMain>
      </Theme>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main').getAttribute('id')).toBe('main-content');
  });
});

describe('Separación del shell privado y la pantalla pública', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    setUser(null);
    sessionStorage.clear();

    (globalThis as unknown as { EventSource: unknown }).EventSource = vi.fn(
      () => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onerror: null,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('/pantalla no renderiza AppShell ni navegación privada', async () => {
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/auth/me')) return unauthorizedResponse();
      if (url.includes('/public-display/snapshot')) {
        return okResponse({ currentCall: null, recentCalls: [], serverTime: new Date().toISOString() });
      }

      return unauthorizedResponse();
    });

    const router = createMemoryRouter(appRoutes, { initialEntries: ['/pantalla'] });

    render(
      <Theme accentColor="teal" grayColor="slate">
        <RouterProvider router={router} />
      </Theme>,
    );

    expect(await screen.findByText('Llamados recientes')).toBeDefined();
    expect(screen.queryByRole('navigation', { name: /Navegación principal/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Abrir menú de usuario/i })).toBeNull();
    expect(screen.queryByText('Cubiora PMV')).toBeNull();
  });

  it('redirige al acceso cuando no existe sesión', async () => {
    setUser(null);
    window.fetch = vi.fn(async () => unauthorizedResponse());

    const router = createMemoryRouter(appRoutes, { initialEntries: ['/cajero'] });

    render(
      <Theme accentColor="teal" grayColor="slate">
        <RouterProvider router={router} />
      </Theme>,
    );

    expect(await screen.findByRole('heading', { name: /Iniciar Sesión/i })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: /Navegación principal/i })).toBeNull();
  });

  it('bloquea una ruta administrativa para un rol no autorizado', async () => {
    setUser('CASHIER');
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me')) return okResponse(makeUser('CASHIER'));
      return okResponse(makeAvailableSnapshot());
    });

    const router = createMemoryRouter(appRoutes, { initialEntries: ['/admin/cubiculos'] });

    render(
      <Theme accentColor="teal" grayColor="slate">
        <RouterProvider router={router} />
      </Theme>,
    );

    expect(await screen.findByRole('heading', { name: 'Mi cubículo' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Cubículos' })).toBeNull();
  });

  it('deriva a administración cuando el rol autenticado es ADMIN', async () => {
    setUser('ADMIN');
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me')) return okResponse(makeUser('ADMIN'));
      return unauthorizedResponse();
    });

    const router = createMemoryRouter(appRoutes, { initialEntries: ['/recepcion'] });

    render(
      <Theme accentColor="teal" grayColor="slate">
        <RouterProvider router={router} />
      </Theme>,
    );

    expect(await screen.findByRole('heading', { name: 'Cubículos' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Generar turno' })).toBeNull();
  });
});
