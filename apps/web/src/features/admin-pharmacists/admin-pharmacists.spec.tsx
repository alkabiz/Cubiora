// ─── [SCR-ADM-004] Tests Unitarios de Gestión de Farmacéuticos Registrados ─────
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
  WorkShift,
} from '@cubiora/shared';
import { AdminPharmacistsScreen } from './admin-pharmacists-screen';
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
    id: 'fac-01',
    code: 'SEDE-CEN-01',
    name: 'Punto de Dispensación Central',
    address: 'Av. Córdoba 2351',
    city: 'CABA',
    phone: '+54 11 4964-8000',
    openingHours: '07:00 a 20:00 hs',
    enabledCubiclesCount: 5,
    status: FacilityStatus.ACTIVE,
    isPrimary: true,
    cubiclesCount: 2,
    pharmacistsCount: 2,
    cubicles: [
      {
        id: 'cub-01',
        code: 'CUB-01',
        shortCode: 'C01',
        displayName: 'Cubículo 01',
        status: CubicleStatus.AVAILABLE,
        active: true,
        operatorName: 'Lic. R. Mendoza',
      },
      {
        id: 'cub-02',
        code: 'CUB-02',
        shortCode: 'C02',
        displayName: 'Cubículo 02',
        status: CubicleStatus.AVAILABLE,
        active: true,
        operatorName: null,
      },
    ],
    pharmacists: [],
  },
];

const MOCK_PHARMACISTS = [
  {
    id: 'pharm-01',
    userId: null,
    fullName: 'Lic. R. Mendoza',
    licenseNumber: 'MN-4812',
    operationalRole: PharmacistOperationalRole.TITULAR,
    facilityId: 'fac-01',
    facilityName: 'Punto de Dispensación Central',
    facilityCode: 'SEDE-CEN-01',
    defaultCubicleId: 'cub-01',
    defaultCubicleName: 'Cubículo 01',
    shift: WorkShift.MORNING,
    status: PharmacistStatus.ACTIVE,
    email: 'r.mendoza@cubiora.hospital',
    phone: '+54 11 4964-8001',
    dispatchesCount: 142,
  },
  {
    id: 'pharm-02',
    userId: null,
    fullName: 'Farm. C. Paoli',
    licenseNumber: 'MP-5542',
    operationalRole: PharmacistOperationalRole.ADJUNTO,
    facilityId: 'fac-01',
    facilityName: 'Punto de Dispensación Central',
    facilityCode: 'SEDE-CEN-01',
    defaultCubicleId: null,
    defaultCubicleName: null,
    shift: WorkShift.AFTERNOON,
    status: PharmacistStatus.ON_LEAVE,
    email: 'c.paoli@cubiora.hospital',
    phone: '+54 11 4964-8006',
    dispatchesCount: 84,
  },
];

function setupApiMock() {
  vi.mocked(apiClient).mockImplementation(async (endpoint: string, options?: RequestInit) => {
    if (endpoint.startsWith('/admin/facilities')) {
      return { success: true, data: MOCK_FACILITIES };
    }
    if (endpoint.startsWith('/admin/pharmacists')) {
      const method = options?.method ?? 'GET';
      if (method === 'GET') {
        return {
          success: true,
          data: {
            items: MOCK_PHARMACISTS,
            metrics: {
              totalRegistered: 8,
              activeToday: 7,
              onLeaveCount: 1,
              totalDispatches: 1007,
              averageServiceMinutes: 6.4,
              assignedFacilitiesCount: 3,
            },
          },
        };
      }
      if (method === 'POST') {
        const body = JSON.parse(String(options?.body ?? '{}'));
        return {
          success: true,
          data: {
            id: 'pharm-new',
            userId: null,
            ...body,
            facilityName: 'Punto de Dispensación Central',
            facilityCode: 'SEDE-CEN-01',
            defaultCubicleName: 'Cubículo 02',
            dispatchesCount: 0,
          },
        };
      }
      if (method === 'PATCH' && endpoint.endsWith('/status')) {
        return {
          success: true,
          data: { ...MOCK_PHARMACISTS[0], status: PharmacistStatus.ON_LEAVE },
        };
      }
      if (method === 'PATCH') {
        const body = JSON.parse(String(options?.body ?? '{}'));
        return {
          success: true,
          data: { ...MOCK_PHARMACISTS[0], ...body },
        };
      }
      if (method === 'DELETE') {
        return { success: true, data: { deleted: true, id: 'pharm-01' } };
      }
    }
    return { success: true, data: {} };
  });
}

async function selectRadixOption(trigger: HTMLElement, optionName: RegExp | string) {
  fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
  const listbox = await screen.findByRole('listbox');
  const option = within(listbox).getByRole('option', { name: optionName });
  fireEvent.click(option);
}

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Theme accentColor="teal" grayColor="slate">
        <MemoryRouter>
          <AdminPharmacistsScreen />
        </MemoryRouter>
      </Theme>
    </QueryClientProvider>,
  );
};

describe('[SCR-ADM-004] Gestión de Farmacéuticos Registrados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMock();
  });

  it('1. Renderiza KPIs, filtros y el directorio de farmacéuticos registrados', async () => {
    renderScreen();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Gestión de Farmacéuticos Registrados/i,
      }),
    ).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
      expect(screen.getByText('MN-4812')).toBeDefined();
      expect(screen.getByText('Farm. C. Paoli')).toBeDefined();
      expect(screen.getByText('MP-5542')).toBeDefined();
    });

    expect(screen.getByText('1007')).toBeDefined();
    expect(screen.getByRole('link', { name: /Ver mapa y sedes →/i })).toBeDefined();
  });

  it('2. Envía filtros de búsqueda y rol como query params a GET /admin/pharmacists', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
    });

    const searchInput = screen.getByLabelText(/Buscar profesional/i);
    fireEvent.change(searchInput, { target: { value: 'Mendoza' } });

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('/admin/pharmacists?search=Mendoza'),
      );
    });
  });

  it('3. Valida y registra un nuevo farmacéutico mediante Radix Dialog + RHF + Zod', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Registrar Farmacéutico/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Registrar Farmacéutico Profesional')).toBeDefined();

    // Enviar vacío debe mostrar errores de validación Zod
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar Farmacéutico' }));
    expect(
      await within(dialog).findByText(/El nombre completo debe tener al menos 3 caracteres/i),
    ).toBeDefined();

    fireEvent.change(within(dialog).getByLabelText(/Nombre completo/i), {
      target: { value: 'Lic. Elena Pardo' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Matrícula profesional/i), {
      target: { value: 'MN-9988' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Correo electrónico institucional/i), {
      target: { value: 'e.pardo@cubiora.hospital' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Teléfono de contacto/i), {
      target: { value: '+54 11 4964-8899' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar Farmacéutico' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/pharmacists',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"licenseNumber":"MN-9988"'),
        }),
      );
    });
  });

  it('4. Permite editar un farmacéutico existente con PATCH /admin/pharmacists/:id', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar a Lic. R. Mendoza' }));
    const dialog = await screen.findByRole('dialog');

    const nameField = within(dialog).getByLabelText(/Nombre completo/i) as HTMLInputElement;
    expect(nameField.value).toBe('Lic. R. Mendoza');

    fireEvent.change(nameField, { target: { value: 'Lic. Rodrigo Mendoza' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/pharmacists/pharm-01',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"fullName":"Lic. Rodrigo Mendoza"'),
        }),
      );
    });
  });

  it('5. Permite cambio rápido de estado operativo vía PATCH /admin/pharmacists/:id/status', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
    });

    const statusTrigger = screen.getByRole('combobox', {
      name: 'Estado operativo de Lic. R. Mendoza',
    });
    await selectRadixOption(statusTrigger, 'LICENCIA');

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/pharmacists/pharm-01/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: PharmacistStatus.ON_LEAVE }),
        }),
      );
    });
  });

  it('6. Confirma eliminación y llama a DELETE /admin/pharmacists/:id', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar a Lic. R. Mendoza' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Cubículo 01/i)).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar eliminación' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/pharmacists/pharm-01',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});

