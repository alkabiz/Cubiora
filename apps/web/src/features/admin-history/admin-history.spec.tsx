// ─── [SCR-ADM-003] Tests Unitarios de Historial · Registro Operativo Diario ────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';
import {
  DispensationResolution,
  QueueCategory,
  TicketStatus,
  type TicketHistoryResponse,
} from '@cubiora/shared';
import { AdminHistoryScreen } from './admin-history-screen';
import { escapeCsvField } from './csv-export';
import { DailyAuditTable } from './daily-audit-table';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

const MOCK_HISTORY_RESPONSE: TicketHistoryResponse = {
  items: [
    {
      id: 'hist-1',
      publicId: 'pub-1',
      publicCode: 'TUR-000119-L2',
      patientName: 'Paciente A',
      status: TicketStatus.CLOSED,
      queueCategory: QueueCategory.GENERAL,
      assignedStation: 'Cubículo 04',
      cubicleCode: 'CUB-04',
      operatorName: 'Farm. S. Quintero',
      serviceDurationSeconds: 412,
      waitingDurationSeconds: 120,
      slaCompliant: true,
      createdAt: '2026-10-20T09:00:00.000Z',
      dispensation: {
        id: 'disp-1',
        ticketId: 'hist-1',
        cubicleId: 'CUB-04',
        operatorUserId: 'usr-1',
        resolution: DispensationResolution.TOTAL_DELIVERED,
        itemsDeliveredCount: 2,
        itemsPendingCount: 0,
        createdAt: '2026-10-20T09:10:00.000Z',
      },
    },
    {
      id: 'hist-2',
      publicId: 'pub-2',
      publicCode: 'TUR-000118-H1',
      patientName: 'Paciente B',
      status: TicketStatus.CLOSED,
      queueCategory: QueueCategory.PREFERENTIAL,
      assignedStation: 'Cubículo 03',
      cubicleCode: 'CUB-03',
      operatorName: 'Lic. R. Mendoza',
      serviceDurationSeconds: 420,
      waitingDurationSeconds: 90,
      slaCompliant: true,
      createdAt: '2026-10-20T09:15:00.000Z',
    },
    {
      id: 'hist-3',
      publicId: 'pub-3',
      publicCode: 'TUR-000117-K9',
      patientName: 'Paciente C',
      status: TicketStatus.CLOSED,
      queueCategory: QueueCategory.HIGH_COST,
      assignedStation: 'Cubículo 01',
      cubicleCode: 'CUB-01',
      operatorName: 'Lic. M. Arismendi',
      serviceDurationSeconds: 780,
      waitingDurationSeconds: 180,
      slaCompliant: false,
      createdAt: '2026-10-20T09:20:00.000Z',
      dispensation: {
        id: 'disp-3',
        ticketId: 'hist-3',
        cubicleId: 'CUB-01',
        operatorUserId: 'usr-2',
        resolution: DispensationResolution.PENDING_48H,
        itemsDeliveredCount: 1,
        itemsPendingCount: 1,
        createdAt: '2026-10-20T09:33:00.000Z',
      },
    },
    {
      id: 'hist-4',
      publicId: 'pub-4',
      publicCode: 'TUR-000116-X3',
      patientName: 'Paciente D',
      status: TicketStatus.NO_SHOW,
      queueCategory: QueueCategory.GENERAL,
      assignedStation: 'Cubículo 02',
      cubicleCode: 'CUB-02',
      operatorName: 'Farm. J. Duarte',
      serviceDurationSeconds: 120,
      waitingDurationSeconds: 60,
      slaCompliant: true,
      createdAt: '2026-10-20T09:25:00.000Z',
    },
  ],
  total: 4,
  page: 1,
  limit: 100,
  totalPages: 1,
  slaThresholdSeconds: 600,
};

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Theme accentColor="blue" grayColor="slate">
        <MemoryRouter>
          <AdminHistoryScreen />
        </MemoryRouter>
      </Theme>
    </QueryClientProvider>,
  );
};

describe('[SCR-ADM-003] Historial · Registro Operativo Diario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: MOCK_HISTORY_RESPONSE,
    });
  });

  it('1. Renderiza el Header superior con breadcrumbs, título principal, Exportar CSV y enlace de regreso', async () => {
    renderComponent();

    // Breadcrumb / sección
    expect(screen.getByText('Auditoría Operativa de Tiempos y Despacho')).toBeDefined();

    // Título Principal
    expect(
      screen.getByRole('heading', { level: 1, name: 'Historial Operativo Diario' }),
    ).toBeDefined();

    // Botones de acción
    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeDefined();
    expect(screen.getByText('← Volver al Panel General')).toBeDefined();

    await screen.findByText('TUR-000119-L2');
  });

  it('2. Hidrata y renderiza los registros del backend con sus puestos, operadores, tiempos, SLA y resultados', async () => {
    renderComponent();

    await screen.findByText('TUR-000119-L2');

    // 1. Códigos de turno
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
    expect(screen.getByText('TUR-000117-K9')).toBeDefined();
    expect(screen.getByText('TUR-000116-X3')).toBeDefined();

    // 2. Puestos asignados
    expect(screen.getByText('Cubículo 04')).toBeDefined();
    expect(screen.getByText('Cubículo 03')).toBeDefined();
    expect(screen.getByText('Cubículo 01')).toBeDefined();
    expect(screen.getByText('Cubículo 02')).toBeDefined();

    // 3. Operadores
    expect(screen.getByText('Farm. S. Quintero')).toBeDefined();
    expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
    expect(screen.getByText('Lic. M. Arismendi')).toBeDefined();
    expect(screen.getByText('Farm. J. Duarte')).toBeDefined();

    // 4. Prioridades
    expect(screen.getAllByText('GENERAL').length).toBe(2);
    expect(screen.getByText('PREFERENCIAL')).toBeDefined();
    expect(screen.getByText('Alto Costo')).toBeDefined();

    // 5. Tiempos de atención
    expect(screen.getByText('6m 52s')).toBeDefined();
    expect(screen.getByText('7m 0s')).toBeDefined();
    expect(screen.getByText('13m 0s')).toBeDefined();
    expect(screen.getByText('2m 0s')).toBeDefined();

    // 6. Cumplimiento SLA
    expect(screen.getAllByText('Cumplido').length).toBe(3);
    expect(screen.getByText('Excedido')).toBeDefined();

    // 7. Badges de resultado
    expect(screen.getAllByText('FINALIZADO').length).toBe(2);
    expect(screen.getByText('Pendiente 48h')).toBeDefined();
    expect(screen.getByText('ABANDONADO')).toBeDefined();
  });

  it('3. Filtra registros en tiempo real mediante el input de búsqueda', async () => {
    renderComponent();
    await screen.findByText('TUR-000119-L2');

    const searchInput = screen.getByPlaceholderText('Buscar por código de turno o puesto...');

    // Filtrar por código
    fireEvent.change(searchInput, { target: { value: 'TUR-000118' } });
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
    expect(screen.queryByText('TUR-000119-L2')).toBeNull();
    expect(screen.queryByText('TUR-000117-K9')).toBeNull();

    // Filtrar por puesto
    fireEvent.change(searchInput, { target: { value: 'Cubículo 01' } });
    expect(screen.getByText('TUR-000117-K9')).toBeDefined();
    expect(screen.queryByText('TUR-000118-H1')).toBeNull();

    // Filtrar por operador
    fireEvent.change(searchInput, { target: { value: 'Duarte' } });
    expect(screen.getByText('TUR-000116-X3')).toBeDefined();
    expect(screen.queryByText('TUR-000117-K9')).toBeNull();

    // Limpiar búsqueda
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('TUR-000119-L2')).toBeDefined();
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
  });

  it('4. Muestra etiqueta SLA dinámica del servidor y conmuta entre Todos, En Norma y Excedidos', async () => {
    renderComponent();
    await screen.findByText('TUR-000119-L2');

    const allBtn = screen.getByRole('button', { name: 'Todos' });
    const inNormBtn = screen.getByRole('button', { name: /En Norma \(≤10m\)/i });
    const exceededBtn = screen.getByRole('button', { name: 'Excedidos' });

    // En Norma (según slaCompliant del servidor)
    fireEvent.click(inNormBtn);
    expect(screen.getByText('TUR-000119-L2')).toBeDefined();
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
    expect(screen.getByText('TUR-000116-X3')).toBeDefined();
    expect(screen.queryByText('TUR-000117-K9')).toBeNull();

    // Excedidos
    fireEvent.click(exceededBtn);
    expect(screen.getByText('TUR-000117-K9')).toBeDefined();
    expect(screen.queryByText('TUR-000119-L2')).toBeNull();

    // Filtro sin coincidencias
    const searchInput = screen.getByPlaceholderText('Buscar por código de turno o puesto...');
    fireEvent.change(searchInput, { target: { value: 'INEXISTENTE' } });
    expect(
      screen.getByText('No se encontraron registros que coincidan con los criterios de filtro.'),
    ).toBeDefined();

    // Volver a Todos sin búsqueda
    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.click(allBtn);
    expect(screen.getByText('TUR-000119-L2')).toBeDefined();
    expect(screen.getByText('TUR-000117-K9')).toBeDefined();
  });

  it('5. Genera la exportación CSV al pulsar el botón "Exportar CSV"', async () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    renderComponent();
    await screen.findByText('TUR-000119-L2');

    const exportBtn = screen.getByRole('button', { name: /Exportar CSV/i });
    fireEvent.click(exportBtn);

    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('6. Pagina correctamente cuando el volumen de turnos excede la página (escalabilidad >= 25 turnos)', () => {
    const manyRecords = Array.from({ length: 60 }, (_, i) => ({
      id: `rec_${i + 1}`,
      ticketCode: `TUR-000${String(i + 1).padStart(3, '0')}-A1`,
      assignedStation: 'Cubículo 01',
      operatorName: 'Lic. M. Arismendi',
      priority: 'GENERAL' as const,
      serviceDurationFormatted: '5m 0s',
      serviceDurationSeconds: 300,
      slaCompliant: true,
      resultStatus: 'FINALIZADO' as const,
      finishedAtFormatted: '10:00:00',
    }));

    render(
      <Theme accentColor="blue" grayColor="slate">
        <DailyAuditTable records={manyRecords} pageSize={25} />
      </Theme>,
    );

    // Debe mostrar la primera página con 25 registros
    expect(screen.getByText('TUR-000001-A1')).toBeDefined();
    expect(screen.getByText('TUR-000025-A1')).toBeDefined();
    expect(screen.queryByText('TUR-000026-A1')).toBeNull();

    // Controles de paginación
    expect(
      screen.getByText((_content, element) => {
        return element?.tagName.toLowerCase() === 'div' && element.textContent?.trim() === 'Mostrando 1 a 25 de 60 registros';
      }),
    ).toBeDefined();
    expect(screen.getByText('Página 1 de 3')).toBeDefined();

    // Avanzar a la página 2
    const nextBtn = screen.getByRole('button', { name: 'Siguiente' });
    fireEvent.click(nextBtn);

    expect(screen.queryByText('TUR-000001-A1')).toBeNull();
    expect(screen.getByText('TUR-000026-A1')).toBeDefined();
    expect(screen.getByText('Página 2 de 3')).toBeDefined();
  });

  it('7. Muestra estado vacío honesto sin datos falsos cuando la API devuelve [] y alerta con reintento si falla', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
        slaThresholdSeconds: 600,
      },
    });

    renderComponent();
    expect(await screen.findByText('No hay registros operativos finalizados aún.')).toBeDefined();
    expect(screen.queryByText('TUR-000119-L2')).toBeNull();

    // Ahora probar fallo de red y reintento exitoso
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('Network down'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(
        screen.getByText(/No fue posible cargar el historial operativo del servidor/i),
      ).toBeDefined();
    });

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: MOCK_HISTORY_RESPONSE,
    });
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    expect(await screen.findByText('TUR-000119-L2')).toBeDefined();
  });

  it('8. Abre el modal de trazabilidad consultando GET /tickets/:publicId/history y muestra línea de tiempo y dispensación', async () => {
    vi.mocked(apiClient).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/tickets/pub-1/history') {
        return {
          success: true,
          data: {
            ticket: {
              ...MOCK_HISTORY_RESPONSE.items[0],
              maskedDocument: 'C.C. ••••••1234',
            },
            terminalReason: 'Dispensación completada en ventanilla',
            statusHistory: [
              {
                id: 'sh-1',
                fromStatus: null,
                toStatus: TicketStatus.PENDING,
                cubicleCode: null,
                cubicleDisplayName: null,
                actorName: 'Recepción',
                actorRole: 'RECEPTION',
                reasonCode: 'CREATED',
                correlationId: 'corr-1',
                createdAt: '2026-10-20T09:00:00.000Z',
              },
              {
                id: 'sh-2',
                fromStatus: TicketStatus.IN_SERVICE,
                toStatus: TicketStatus.CLOSED,
                cubicleCode: 'CUB-04',
                cubicleDisplayName: 'Cubículo 04',
                actorName: 'Farm. S. Quintero',
                actorRole: 'CASHIER',
                reasonCode: null,
                correlationId: 'corr-2',
                createdAt: '2026-10-20T09:10:00.000Z',
              },
            ],
            calls: [
              {
                id: 'call-1',
                callNumber: 1,
                cubicleCode: 'CUB-04',
                cubicleDisplayName: 'Cubículo 04',
                callerName: 'Farm. S. Quintero',
                createdAt: '2026-10-20T09:02:00.000Z',
              },
            ],
            dispensation: {
              ...MOCK_HISTORY_RESPONSE.items[0]!.dispensation!,
              prescriptionCode: 'RX-2026-991',
            },
          },
        };
      }
      return { success: true, data: MOCK_HISTORY_RESPONSE };
    });

    renderComponent();
    await screen.findByText('TUR-000119-L2');

    fireEvent.click(
      screen.getByRole('button', { name: /Ver trazabilidad del turno TUR-000119-L2/i }),
    );

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith('/tickets/pub-1/history');
      expect(within(dialog).getByText('Trazabilidad del turno TUR-000119-L2')).toBeDefined();
      expect(within(dialog).getByText('C.C. ••••••1234')).toBeDefined();
      expect(within(dialog).getByText('Creación → En espera')).toBeDefined();
      expect(within(dialog).getByText('En atención → Cerrado')).toBeDefined();
      expect(within(dialog).getByText(/Llamado #1 · Cubículo 04/i)).toBeDefined();
      expect(within(dialog).getByText('RX-2026-991')).toBeDefined();
    });
  });

  it('9. Muestra controles de paginación de servidor cuando totalPages > 1 y carga el siguiente lote', async () => {
    vi.mocked(apiClient).mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('page=2')) {
        return {
          success: true,
          data: {
            ...MOCK_HISTORY_RESPONSE,
            items: [
              {
                ...MOCK_HISTORY_RESPONSE.items[0]!,
                id: 'hist-page-2',
                publicId: 'pub-page-2',
                publicCode: 'TUR-000201-GE',
              },
            ],
            page: 2,
            total: 120,
            totalPages: 2,
          },
        };
      }
      return {
        success: true,
        data: {
          ...MOCK_HISTORY_RESPONSE,
          page: 1,
          total: 120,
          totalPages: 2,
        },
      };
    });

    renderComponent();
    await screen.findByText('TUR-000119-L2');

    const serverNav = screen.getByRole('navigation', {
      name: /Paginación de resultados del servidor/i,
    });
    expect(serverNav.textContent).toContain('Página del servidor 1 de 2');
    expect(serverNav.textContent).toContain('120');

    fireEvent.click(within(serverNav).getByRole('button', { name: 'Siguiente lote' }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(expect.stringContaining('page=2'));
      expect(screen.getByText('TUR-000201-GE')).toBeDefined();
    });
  });

  it('10. Neutraliza inyección de fórmulas en exportación CSV sin alterar valores normales', () => {
    expect(escapeCsvField('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(escapeCsvField('+1+1')).toBe('"\'+1+1"');
    expect(escapeCsvField('-1+1')).toBe('"\'-1+1"');
    expect(escapeCsvField('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    expect(escapeCsvField('\t=1')).toBe('"\'\t=1"');
    expect(escapeCsvField('|cmd')).toBe('"\'|cmd"');
    expect(escapeCsvField('\n=1')).toBe('"\'\n=1"');
    expect(escapeCsvField(' =1')).toBe('"\' =1"');
    expect(escapeCsvField('Lic. M. Arismendi')).toBe('"Lic. M. Arismendi"');
    expect(escapeCsvField(null)).toBe('""');
  });
});
