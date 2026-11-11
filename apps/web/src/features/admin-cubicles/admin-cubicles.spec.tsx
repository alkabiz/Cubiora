// ─── [SCR-ADM-002] Tests Unitarios de Configuración de Cubículos ──────────────
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
  QueueCategory,
  WorkShift,
  type AdminCubicleConfigDto,
  type FacilityDto,
  type PharmacistDto,
} from '@cubiora/shared';
import { AdminCubiclesScreen } from './admin-cubicles-screen';
import { apiClient, ApiClientError } from '../../lib/api';

// Mock de socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

// Mock de apiClient preservando unwrapApiData y ApiClientError reales
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

const MOCK_FACILITY: FacilityDto = {
  id: 'fac-cen-01',
  code: 'SEDE-CEN-01',
  name: 'Punto de Dispensación Central',
  address: 'Av. Córdoba 2351',
  city: 'CABA',
  phone: '+54 11 4964-8000',
  openingHours: '07:00 a 20:00 hs',
  enabledCubiclesCount: 5,
  status: FacilityStatus.ACTIVE,
  isPrimary: true,
  cubiclesCount: 5,
  pharmacistsCount: 4,
  cubicles: [],
  pharmacists: [],
};

const MOCK_PHARMACISTS: PharmacistDto[] = [
  {
    id: 'pharm-cub-01',
    userId: null,
    fullName: 'Lic. M. Arismendi',
    licenseNumber: 'MN-3914',
    operationalRole: PharmacistOperationalRole.TITULAR,
    facilityId: 'fac-cen-01',
    facilityName: 'Punto de Dispensación Central',
    facilityCode: 'SEDE-CEN-01',
    defaultCubicleId: 'CUB-01',
    defaultCubicleName: 'Cubículo 01',
    shift: WorkShift.MORNING,
    status: PharmacistStatus.ACTIVE,
    email: 'm.arismendi@cubiora.hospital',
    phone: '+54 11 4964-8001',
    dispatchesCount: 188,
  },
  {
    id: 'pharm-cub-02',
    userId: null,
    fullName: 'Farm. J. Duarte',
    licenseNumber: 'MP-8921',
    operationalRole: PharmacistOperationalRole.ADJUNTO,
    facilityId: 'fac-cen-01',
    facilityName: 'Punto de Dispensación Central',
    facilityCode: 'SEDE-CEN-01',
    defaultCubicleId: 'CUB-02',
    defaultCubicleName: 'Cubículo 02',
    shift: WorkShift.AFTERNOON,
    status: PharmacistStatus.ACTIVE,
    email: 'j.duarte@cubiora.hospital',
    phone: '+54 11 4964-8002',
    dispatchesCount: 96,
  },
  {
    id: 'pharm-cub-03',
    userId: null,
    fullName: 'Lic. R. Mendoza',
    licenseNumber: 'MN-4812',
    operationalRole: PharmacistOperationalRole.TITULAR,
    facilityId: 'fac-cen-01',
    facilityName: 'Punto de Dispensación Central',
    facilityCode: 'SEDE-CEN-01',
    defaultCubicleId: 'CUB-03',
    defaultCubicleName: 'Cubículo 03',
    shift: WorkShift.MORNING,
    status: PharmacistStatus.ACTIVE,
    email: 'r.mendoza@cubiora.hospital',
    phone: '+54 11 4964-8003',
    dispatchesCount: 142,
  },
  {
    id: 'pharm-cub-04',
    userId: null,
    fullName: 'Farm. S. Quintero',
    licenseNumber: 'MN-7230',
    operationalRole: PharmacistOperationalRole.DISPENSADOR,
    facilityId: 'fac-cen-01',
    facilityName: 'Punto de Dispensación Central',
    facilityCode: 'SEDE-CEN-01',
    defaultCubicleId: 'CUB-04',
    defaultCubicleName: 'Cubículo 04',
    shift: WorkShift.ROTATING,
    status: PharmacistStatus.ACTIVE,
    email: 's.quintero@cubiora.hospital',
    phone: '+54 11 4964-8004',
    dispatchesCount: 115,
  },
];

function createInitialCubicleDtos(): AdminCubicleConfigDto[] {
  return [
    {
      id: 'CUB-01',
      code: 'CUB-01',
      displayName: 'Cubículo 01',
      operatorName: 'Lic. M. Arismendi',
      status: CubicleStatus.BUSY,
      active: true,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: 'fac-cen-01',
      facilityCode: 'SEDE-CEN-01',
      facilityName: 'Punto de Dispensación Central',
      pharmacistId: 'pharm-cub-01',
      pharmacistName: 'Lic. M. Arismendi',
      pharmacistLicenseNumber: 'MN-3914',
      dailyCompletedCount: 38,
      slaThresholdSeconds: 720,
      version: 1,
    },
    {
      id: 'CUB-02',
      code: 'CUB-02',
      displayName: 'Cubículo 02',
      operatorName: 'Farm. J. Duarte',
      status: CubicleStatus.RESERVED,
      active: true,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: 'fac-cen-01',
      facilityCode: 'SEDE-CEN-01',
      facilityName: 'Punto de Dispensación Central',
      pharmacistId: 'pharm-cub-02',
      pharmacistName: 'Farm. J. Duarte',
      pharmacistLicenseNumber: 'MP-8921',
      dailyCompletedCount: 34,
      slaThresholdSeconds: 720,
      version: 1,
    },
    {
      id: 'CUB-03',
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      operatorName: 'Lic. R. Mendoza',
      status: CubicleStatus.CALLING,
      active: true,
      allowedCategories: [QueueCategory.PREFERENTIAL],
      facilityId: 'fac-cen-01',
      facilityCode: 'SEDE-CEN-01',
      facilityName: 'Punto de Dispensación Central',
      pharmacistId: 'pharm-cub-03',
      pharmacistName: 'Lic. R. Mendoza',
      pharmacistLicenseNumber: 'MN-4812',
      dailyCompletedCount: 41,
      slaThresholdSeconds: 720,
      version: 1,
    },
    {
      id: 'CUB-04',
      code: 'CUB-04',
      displayName: 'Cubículo 04',
      operatorName: 'Farm. S. Quintero',
      status: CubicleStatus.AVAILABLE,
      active: true,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: 'fac-cen-01',
      facilityCode: 'SEDE-CEN-01',
      facilityName: 'Punto de Dispensación Central',
      pharmacistId: 'pharm-cub-04',
      pharmacistName: 'Farm. S. Quintero',
      pharmacistLicenseNumber: 'MN-7230',
      dailyCompletedCount: 35,
      slaThresholdSeconds: 720,
      version: 1,
    },
    {
      id: 'CUB-05',
      code: 'CUB-05',
      displayName: 'Cubículo 05',
      operatorName: null,
      status: CubicleStatus.INACTIVE,
      active: false,
      allowedCategories: [QueueCategory.GENERAL],
      facilityId: 'fac-cen-01',
      facilityCode: 'SEDE-CEN-01',
      facilityName: 'Punto de Dispensación Central',
      pharmacistId: null,
      pharmacistName: null,
      pharmacistLicenseNumber: null,
      dailyCompletedCount: 0,
      slaThresholdSeconds: 720,
      version: 1,
    },
  ];
}

interface MockControlOptions {
  failNextAssignError?: Error;
  failNextStatusError?: Error;
}

function setupDefaultApiMock(ctrl: MockControlOptions = {}) {
  const cubicleStore = createInitialCubicleDtos();

  vi.mocked(apiClient).mockImplementation(async (endpoint: string, options?: RequestInit) => {
    if (endpoint.startsWith('/admin/facilities')) {
      return { success: true, data: [MOCK_FACILITY] };
    }
    if (endpoint.startsWith('/admin/pharmacists')) {
      return {
        success: true,
        data: {
          items: MOCK_PHARMACISTS,
          metrics: {
            totalRegistered: MOCK_PHARMACISTS.length,
            activeToday: MOCK_PHARMACISTS.length,
            onLeaveCount: 0,
            totalDispatches: 541,
            averageServiceMinutes: 6.4,
            assignedFacilitiesCount: 1,
          },
        },
      };
    }
    if (endpoint === '/admin/cubicles' || endpoint.startsWith('/admin/cubicles?')) {
      return { success: true, data: cubicleStore.map((c) => ({ ...c })) };
    }
    if (endpoint.includes('/assign-pharmacist')) {
      if (ctrl.failNextAssignError) {
        const err = ctrl.failNextAssignError;
        ctrl.failNextAssignError = undefined;
        throw err;
      }
      const cubId = endpoint.split('/')[3];
      const body = JSON.parse(String(options?.body ?? '{}')) as {
        pharmacistId: string | null;
        operatorName?: string;
      };
      const target = cubicleStore.find((c) => c.id === cubId);
      const prof = MOCK_PHARMACISTS.find((p) => p.id === body.pharmacistId);
      if (target) {
        for (const c of cubicleStore) {
          if (body.pharmacistId && c.pharmacistId === body.pharmacistId) {
            c.pharmacistId = null;
            c.pharmacistName = null;
            c.pharmacistLicenseNumber = null;
            c.operatorName = null;
          }
        }
        target.pharmacistId = body.pharmacistId;
        target.pharmacistName = prof?.fullName ?? null;
        target.pharmacistLicenseNumber = prof?.licenseNumber ?? null;
        target.operatorName = prof?.fullName ?? (body.operatorName || null);
      }
      return { success: true, data: target ? { ...target } : {} };
    }
    if (endpoint.includes('/status')) {
      if (ctrl.failNextStatusError) {
        const err = ctrl.failNextStatusError;
        ctrl.failNextStatusError = undefined;
        throw err;
      }
      const cubId = endpoint.split('/')[3];
      const body = JSON.parse(String(options?.body ?? '{}')) as { active: boolean };
      const target = cubicleStore.find((c) => c.id === cubId);
      if (target) {
        target.active = body.active;
        target.status = body.active ? CubicleStatus.AVAILABLE : CubicleStatus.INACTIVE;
      }
      return { success: true, data: target ? { ...target } : {} };
    }
    return { success: true, data: {} };
  });

  return ctrl;
}

async function selectRadixOption(trigger: HTMLElement, optionName: RegExp | string) {
  fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
  const listbox = await screen.findByRole('listbox');
  const option = within(listbox).getByRole('option', { name: optionName });
  fireEvent.click(option);
}

const renderComponent = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Theme accentColor="blue" grayColor="slate">
        <MemoryRouter>
          <AdminCubiclesScreen />
        </MemoryRouter>
      </Theme>
    </QueryClientProvider>,
  );
};

describe('[SCR-ADM-002] Administración · Configuración de Cubículos', () => {
  let mockCtrl: MockControlOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtrl = setupDefaultApiMock();
  });

  it('1. Renderiza Header con sede activa y accesos a Farmacéuticos y Sedes', async () => {
    renderComponent();

    expect(screen.getByText('Administración · Parametrización de Puestos')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Configuración de Cubículos' }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: /Directorio de Farmacéuticos/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /Cambiar Sede/i })).toBeDefined();
    expect(screen.getByText('← Volver al Panel General')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Punto de Dispensación Central \(SEDE-CEN-01\)/i)).toBeDefined();
    });
  });

  it('2. Hidrata desde API los cubículos con sus nombres, números y módulos', async () => {
    renderComponent();

    expect(await screen.findByText('Cubículo 01')).toBeDefined();
    expect(screen.getByText('Cubículo 02')).toBeDefined();
    expect(screen.getByText('Cubículo 03')).toBeDefined();
    expect(screen.getByText('Cubículo 04')).toBeDefined();
    expect(screen.getByText('Cubículo 05')).toBeDefined();

    expect(screen.getByText('01')).toBeDefined();
    expect(screen.getByText('02')).toBeDefined();
    expect(screen.getByText('03')).toBeDefined();
    expect(screen.getByText('04')).toBeDefined();
    expect(screen.getByText('05')).toBeDefined();

    expect(screen.getAllByText('Módulo MOD-A').length).toBe(2);
    expect(screen.getAllByText('Módulo MOD-B').length).toBe(2);
    expect(screen.getByText('Módulo MOD-C')).toBeDefined();
  });

  it('3. Renderiza los badges semánticos de estado y métricas reales recibidas del servidor', async () => {
    renderComponent();

    await screen.findByText('Cubículo 01');

    expect(screen.getByText('ATENDIENDO')).toBeDefined();
    expect(screen.getByText('LLAMANDO')).toBeDefined();
    expect(screen.getAllByText('DISPONIBLE').length).toBe(2);
    expect(screen.getByText('INACTIVO')).toBeDefined();

    expect(screen.getAllByText('12 min').length).toBe(5);
    expect(screen.getByText('38 turnos')).toBeDefined();
    expect(screen.getByText('34 turnos')).toBeDefined();
    expect(screen.getByText('41 turnos')).toBeDefined();
    expect(screen.getByText('35 turnos')).toBeDefined();
    expect(screen.getByText('0 turnos')).toBeDefined();
  });

  it('4. Asigna un farmacéutico registrado desde el Selector y llama a PATCH /admin/cubicles/:id/assign-pharmacist', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Matrícula MN-3914/i)).toBeDefined();
    });

    const triggerCub1 = screen.getByRole('combobox', {
      name: /Farmacéutico Asignado para Cubículo 01/i,
    });
    await selectRadixOption(triggerCub1, /Lic\. R\. Mendoza/i);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/cubicles/CUB-01/assign-pharmacist',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            pharmacistId: 'pharm-cub-03',
            operatorName: 'Lic. R. Mendoza',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Guardado')).toBeDefined();
    });
  });

  it('5. Permite desasignar eligiendo "Sin farmacéutico asignado"', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Matrícula MN-3914/i)).toBeDefined();
    });

    const triggerCub1 = screen.getByRole('combobox', {
      name: /Farmacéutico Asignado para Cubículo 01/i,
    });
    await selectRadixOption(triggerCub1, /Sin farmacéutico asignado/i);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/cubicles/CUB-01/assign-pharmacist',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            pharmacistId: null,
            operatorName: '',
          }),
        }),
      );
    });
  });

  it('6. Desactiva y habilita un cubículo llamando a PATCH /admin/cubicles/:id/status', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Matrícula MN-3914/i)).toBeDefined();
    });

    const deactivateButtons = screen.getAllByRole('button', { name: /Desactivar/i });
    expect(deactivateButtons.length).toBe(4);

    fireEvent.click(deactivateButtons[0]!);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/cubicles/CUB-01/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ active: false }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('ATENDIENDO')).toBeNull();
      expect(screen.getAllByText('INACTIVO').length).toBe(2);
    });

    const enableButton = screen.getAllByRole('button', { name: /Habilitar/i })[0]!;
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        '/admin/cubicles/CUB-01/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ active: true }),
        }),
      );
    });
  });

  it('7. Revierte el cambio de estado y muestra alerta si el servidor responde 409 conflicto', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Matrícula MN-3914/i)).toBeDefined();
    });

    mockCtrl.failNextStatusError = new ApiClientError(
      'STATE_CONFLICT',
      'No se puede desactivar el cubículo mientras tenga un turno activo.',
      409,
    );

    const deactivateButtons = screen.getAllByRole('button', { name: /Desactivar/i });
    fireEvent.click(deactivateButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(
        screen.getByText(/No se puede desactivar el cubículo mientras tenga un turno activo/i),
      ).toBeDefined();
    });
  });

  it('8. Muestra "Error al guardar" con botón Reintentar si falla la asignación de farmacéutico', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Matrícula MN-3914/i)).toBeDefined();
    });

    mockCtrl.failNextAssignError = new Error('Network error');

    const triggerCub1 = screen.getByRole('combobox', {
      name: /Farmacéutico Asignado para Cubículo 01/i,
    });
    await selectRadixOption(triggerCub1, /Farm\. J\. Duarte/i);

    await waitFor(() => {
      expect(screen.getByText('Error al guardar')).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: 'Reintentar' });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Guardado')).toBeDefined();
    });
  });

  it('9. Muestra error y ningún cubículo ficticio cuando falla la carga inicial desde la API', async () => {
    vi.mocked(apiClient).mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/admin/facilities')) {
        return { success: true, data: [MOCK_FACILITY] };
      }
      throw new Error('Backend unavailable');
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(
        screen.getByText(/No fue posible cargar la configuración de cubículos o farmacéuticos/i),
      ).toBeDefined();
    });

    expect(screen.queryByText('Cubículo 01')).toBeNull();
    expect(screen.queryByText(/Lic\. M\. Arismendi/i)).toBeNull();
  });

  it('10. Cuando existen múltiples sedes permite cambiar de sede y carga los cubículos de la sede seleccionada', async () => {
    const northFacility: FacilityDto = {
      id: 'fac-nor-02',
      code: 'SEDE-NOR-02',
      name: 'Centro Ambulatorio Norte',
      address: 'Av. Libertador 6420',
      city: 'CABA',
      phone: '+54 11 4788-2100',
      openingHours: '08:00 a 18:00 hs',
      enabledCubiclesCount: 1,
      status: FacilityStatus.ACTIVE,
      isPrimary: false,
      cubiclesCount: 1,
      pharmacistsCount: 0,
      cubicles: [],
      pharmacists: [],
    };

    const northCubicles: AdminCubicleConfigDto[] = [
      {
        id: 'cub-n01',
        code: 'CUB-N01',
        displayName: 'Cubículo Norte 01',
        operatorName: null,
        status: CubicleStatus.AVAILABLE,
        active: true,
        allowedCategories: [QueueCategory.GENERAL],
        facilityId: 'fac-nor-02',
        facilityCode: 'SEDE-NOR-02',
        facilityName: 'Centro Ambulatorio Norte',
        pharmacistId: null,
        pharmacistName: null,
        pharmacistLicenseNumber: null,
        dailyCompletedCount: 7,
        slaThresholdSeconds: 720,
        version: 1,
      },
    ];

    const centralCubicles = createInitialCubicleDtos();

    vi.mocked(apiClient).mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/admin/facilities')) {
        return { success: true, data: [MOCK_FACILITY, northFacility] };
      }
      if (endpoint.startsWith('/admin/pharmacists')) {
        return {
          success: true,
          data: {
            items: endpoint.includes('facilityId=fac-nor-02') ? [] : MOCK_PHARMACISTS,
            metrics: {
              totalRegistered: 4,
              activeToday: 4,
              onLeaveCount: 0,
              totalDispatches: 541,
              averageServiceMinutes: 6.4,
              assignedFacilitiesCount: 2,
            },
          },
        };
      }
      if (endpoint === '/admin/cubicles?facilityId=fac-nor-02') {
        return { success: true, data: northCubicles };
      }
      if (endpoint.startsWith('/admin/cubicles')) {
        return { success: true, data: centralCubicles };
      }
      return { success: true, data: {} };
    });

    renderComponent();

    expect(await screen.findByText('Cubículo 01')).toBeDefined();

    const facilitySelect = screen.getByRole('combobox', {
      name: /Seleccionar sede hospitalaria/i,
    });
    await selectRadixOption(facilitySelect, /Centro Ambulatorio Norte \(SEDE-NOR-02\)/i);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith('/admin/cubicles?facilityId=fac-nor-02');
      expect(screen.getByText('Cubículo Norte 01')).toBeDefined();
      expect(screen.queryByText('Cubículo 01')).toBeNull();
    });
  });
});
