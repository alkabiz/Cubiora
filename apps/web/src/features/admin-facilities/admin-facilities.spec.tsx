// ─── [SCR-ADM-005] Tests Unitarios de Gestión de Sedes y Usuarios ──────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import {
  CubicleStatus,
  FacilityStatus,
  PharmacistOperationalRole,
  PharmacistStatus,
  UserRole,
  WorkShift,
  type AdminUserDto,
} from '@cubiora/shared';
import { AdminFacilitiesScreen } from './admin-facilities-screen';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

const MOCK_FACILITIES = [
  {
    id: 'fac-cen-01',
    code: 'SEDE-CEN-01',
    name: 'Punto de Dispensación Central',
    address: 'Av. Córdoba 2351',
    city: 'CABA',
    phone: '+54 11 4964-8000 (Int. 142)',
    openingHours: '07:00 a 20:00 hs',
    enabledCubiclesCount: 5,
    status: FacilityStatus.ACTIVE,
    isPrimary: true,
    cubiclesCount: 2,
    pharmacistsCount: 1,
    cubicles: [
      {
        id: 'cub-01',
        code: 'CUB-01',
        shortCode: 'C01',
        displayName: 'Cubículo 01',
        status: CubicleStatus.AVAILABLE,
        active: true,
        operatorName: 'Lic. M. Arismendi',
      },
      {
        id: 'cub-02',
        code: 'CUB-02',
        shortCode: 'C02',
        displayName: 'Cubículo 02',
        status: CubicleStatus.INACTIVE,
        active: false,
        operatorName: null,
      },
    ],
    pharmacists: [
      {
        id: 'pharm-01',
        fullName: 'Lic. M. Arismendi',
        licenseNumber: 'MN-3914',
        operationalRole: PharmacistOperationalRole.TITULAR,
        shift: WorkShift.MORNING,
        status: PharmacistStatus.ACTIVE,
        defaultCubicleId: 'cub-01',
        defaultCubicleName: 'Cubículo 01',
      },
    ],
  },
  {
    id: 'fac-nor-02',
    code: 'SEDE-NOR-02',
    name: 'Centro Ambulatorio Norte',
    address: 'Av. Libertador 6420',
    city: 'CABA',
    phone: '+54 11 4788-2100',
    openingHours: '08:00 a 18:00 hs',
    enabledCubiclesCount: 3,
    status: FacilityStatus.ACTIVE,
    isPrimary: false,
    cubiclesCount: 1,
    pharmacistsCount: 1,
    cubicles: [
      {
        id: 'cub-n01',
        code: 'CUB-N01',
        shortCode: 'CN01',
        displayName: 'Cubículo N01',
        status: CubicleStatus.AVAILABLE,
        active: true,
        operatorName: 'Lic. V. Benítez',
      },
    ],
    pharmacists: [
      {
        id: 'pharm-05',
        fullName: 'Lic. V. Benítez',
        licenseNumber: 'MN-6109',
        operationalRole: PharmacistOperationalRole.TITULAR,
        shift: WorkShift.MORNING,
        status: PharmacistStatus.ACTIVE,
        defaultCubicleId: 'cub-n01',
        defaultCubicleName: 'Cubículo N01',
      },
    ],
  },
];

const MOCK_PHARMACISTS_LIST = [
  {
    id: 'pharm-01',
    userId: null,
    fullName: 'Lic. M. Arismendi',
    licenseNumber: 'MN-3914',
    operationalRole: PharmacistOperationalRole.TITULAR,
    facilityId: 'fac-cen-01',
    facilityName: 'Punto de Dispensación Central',
    facilityCode: 'SEDE-CEN-01',
    defaultCubicleId: 'cub-01',
    defaultCubicleName: 'Cubículo 01',
    shift: WorkShift.MORNING,
    status: PharmacistStatus.ACTIVE,
    email: 'm.arismendi@cubiora.hospital',
    phone: '+54 11 4964-8001',
    dispatchesCount: 188,
  },
  {
    id: 'pharm-05',
    userId: null,
    fullName: 'Lic. V. Benítez',
    licenseNumber: 'MN-6109',
    operationalRole: PharmacistOperationalRole.TITULAR,
    facilityId: 'fac-nor-02',
    facilityName: 'Centro Ambulatorio Norte',
    facilityCode: 'SEDE-NOR-02',
    defaultCubicleId: 'cub-n01',
    defaultCubicleName: 'Cubículo N01',
    shift: WorkShift.MORNING,
    status: PharmacistStatus.ACTIVE,
    email: 'v.benitez@cubiora.hospital',
    phone: '+54 11 4964-8005',
    dispatchesCount: 130,
  },
];

const MOCK_USERS: AdminUserDto[] = [
  {
    id: 'usr-admin-01',
    publicId: '01JUSR01ADMIN',
    username: 'admin_cubiora',
    displayName: 'Administrador General',
    role: UserRole.ADMIN,
    cubicleId: null,
    cubicleCode: null,
    cubicleDisplayName: null,
    active: true,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'usr-cashier-01',
    publicId: '01JUSR02CASHIER',
    username: 'cajero1',
    displayName: 'Carlos Ramírez',
    role: UserRole.CASHIER,
    cubicleId: 'cub-01',
    cubicleCode: 'CUB-01',
    cubicleDisplayName: 'Cubículo 01',
    active: true,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
];

function setupApiMock() {
  const usersStore = MOCK_USERS.map((u) => ({ ...u }));

  vi.mocked(apiClient).mockImplementation(async (endpoint: string, options?: RequestInit) => {
    if (endpoint.startsWith('/admin/users')) {
      const method = options?.method ?? 'GET';
      if (endpoint === '/admin/users' && method === 'GET') {
        return { success: true, data: usersStore.map((u) => ({ ...u })) };
      }
      if (endpoint === '/admin/users' && method === 'POST') {
        const body = JSON.parse(String(options?.body ?? '{}'));
        const created: AdminUserDto = {
          id: `usr-${usersStore.length + 1}`,
          publicId: `01JUSRNEW${usersStore.length + 1}`,
          username: body.username,
          displayName: body.displayName,
          role: body.role,
          cubicleId: body.cubicleId ?? null,
          cubicleCode: body.cubicleId === 'cub-01' ? 'CUB-01' : null,
          cubicleDisplayName: body.cubicleId === 'cub-01' ? 'Cubículo 01' : null,
          active: body.active ?? true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        usersStore.push(created);
        return { success: true, data: created };
      }
      if (endpoint.endsWith('/reset-password') && method === 'POST') {
        return { success: true, data: { reset: true, id: 'usr-cashier-01' } };
      }
      if (method === 'PATCH') {
        const id = endpoint.split('/')[3];
        const body = JSON.parse(String(options?.body ?? '{}'));
        const target = usersStore.find((u) => u.id === id);
        if (target) {
          Object.assign(target, body);
        }
        return { success: true, data: target ?? usersStore[0] };
      }
    }
    if (endpoint.startsWith('/admin/pharmacists')) {
      return {
        success: true,
        data: {
          items: MOCK_PHARMACISTS_LIST,
          metrics: {
            totalRegistered: 2,
            activeToday: 2,
            onLeaveCount: 0,
            totalDispatches: 318,
            averageServiceMinutes: 6.4,
            assignedFacilitiesCount: 2,
          },
        },
      };
    }
    if (endpoint === '/admin/facilities') {
      const method = options?.method ?? 'GET';
      if (method === 'POST') {
        const body = JSON.parse(String(options?.body ?? '{}'));
        return {
          success: true,
          data: {
            id: 'fac-new-05',
            ...body,
            cubiclesCount: body.enabledCubiclesCount ?? 2,
            pharmacistsCount: 0,
            cubicles: [],
            pharmacists: [],
          },
        };
      }
      return { success: true, data: MOCK_FACILITIES };
    }
    if (endpoint.endsWith('/activate')) {
      return {
        success: true,
        data: { ...MOCK_FACILITIES[1], isPrimary: true },
      };
    }
    if (endpoint.endsWith('/assign-pharmacist')) {
      return { success: true, data: MOCK_FACILITIES[0] };
    }
    return { success: true, data: {} };
  });
}

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Theme accentColor="blue" grayColor="slate">
        <MemoryRouter>
          <AdminFacilitiesScreen />
        </MemoryRouter>
      </Theme>
    </QueryClientProvider>,
  );
};

describe('[SCR-ADM-005] Gestión de Sedes y Usuarios Asociados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMock();
  });

  it('1. Renderiza tarjetas de sedes, badge SEDE EN USO y ficha técnica con ventanillas físicas', async () => {
    renderScreen();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Gestión de Sedes y Usuarios Asociados/i,
      }),
    ).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('SEDE-CEN-01').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('SEDE EN USO')).toBeDefined();
      expect(screen.getByText('C01')).toBeDefined();
      expect(screen.getByText('C02')).toBeDefined();
      expect(screen.getByText(/Estado de sesión: Sede Primaria Activa/i)).toBeDefined();
    });
  });

  it('2. Permite inspeccionar otra sede y activarla como Sede Primaria Activa', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Centro Ambulatorio Norte')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Centro Ambulatorio Norte/i }));

    await waitFor(() => {
      expect(screen.getByText('Av. Libertador 6420, CABA')).toBeDefined();
      expect(screen.getByText('CN01')).toBeDefined();
    });

    const activateButtons = screen.getAllByRole('button', {
      name: /Activar como sede actual/i,
    });
    fireEvent.click(activateButtons[0]!);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/facilities/fac-nor-02/activate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('3. Crea una nueva sede mediante Radix Dialog con validación RHF + Zod', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getAllByText('SEDE-CEN-01').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Registrar Nueva Sede/i }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/Código de sede/i), {
      target: { value: 'SEDE-EST-05' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Nombre de la sede/i), {
      target: { value: 'Anexo Pediátrico Este' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Dirección física/i), {
      target: { value: 'Av. Caseros 2100' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Ciudad \/ Jurisdicción/i), {
      target: { value: 'CABA' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Teléfono de guardia/i), {
      target: { value: '+54 11 4300-1122' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar Sede' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/facilities',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"code":"SEDE-EST-05"'),
        }),
      );
    });
  });

  it('4. Permite asociar un farmacéutico a la sede seleccionada', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText(/Usuarios y Farmacéuticos Asociados \(1\)/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Asociar Usuario/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Asociar Farmacéutico a Sede')).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar Asociación' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/facilities/fac-cen-01/assign-pharmacist',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"pharmacistId":"pharm-01"'),
        }),
      );
    });
  });

  it('5. Lista las cuentas operativas del sistema con roles y cubículos asignados', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText(/Cuentas Operativas del Sistema \(2\)/i)).toBeDefined();
      expect(screen.getByText('admin_cubiora')).toBeDefined();
      expect(screen.getByText('cajero1')).toBeDefined();
      expect(screen.getByText('Cubículo 01 (CUB-01)')).toBeDefined();
    });
  });

  it('6. Permite crear una nueva cuenta operativa mediante Radix Dialog y POST /admin/users', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('cajero1')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Crear Cuenta Operativa/i }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/Nombre de usuario/i), {
      target: { value: 'cajero3' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Nombre visible/i), {
      target: { value: 'Laura Gómez' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Contraseña inicial/i), {
      target: { value: 'ClaveSegura2026!' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear Cuenta' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/users',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"username":"cajero3"'),
        }),
      );
      expect(screen.getByText('cajero3')).toBeDefined();
    });
  });

  it('7. Permite restablecer la contraseña de un usuario operativo mediante POST /admin/users/:id/reset-password', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('cajero1')).toBeDefined();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Restablecer contraseña de cajero1/i }),
    );
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/Nueva contraseña/i), {
      target: { value: 'NuevaClave2026!' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Confirmar contraseña/i), {
      target: { value: 'NuevaClave2026!' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Restablecer Contraseña' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/users/usr-cashier-01/reset-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ newPassword: 'NuevaClave2026!' }),
        }),
      );
    });
  });
});

