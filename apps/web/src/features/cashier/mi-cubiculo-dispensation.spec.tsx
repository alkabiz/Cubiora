import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Theme } from '@radix-ui/themes';
import { MiCubiculo } from './mi-cubiculo';
import type { CubicleWorkspace } from './types';
import { DispensationResolution, TicketStatus } from '@cubiora/shared';

function createMockWorkspace(overrides: Partial<CubicleWorkspace> = {}): CubicleWorkspace {
  return {
    cubicleCode: 'CUB-01',
    displayName: 'Cubículo 01',
    cubicleNumber: '01',
    snapshot: null,
    activeTicket: {
      id: 'ticket-1',
      publicId: '01JTICK001',
      publicCode: 'TUR-000100-GE',
      patientName: 'Juan Pérez',
      maskedDocument: '102***',
      status: TicketStatus.IN_SERVICE,
      assignedAt: new Date(Date.now() - 300_000).toISOString(),
      calledAt: new Date(Date.now() - 200_000).toISOString(),
      serviceStartedAt: new Date(Date.now() - 100_000).toISOString(),
      callNumber: 1,
      version: 2,
    },
    step: 'IN_SERVICE',
    pendingAction: null,
    outcome: null,
    isInitialLoading: false,
    isRefreshing: false,
    isOnline: true,
    isReconciling: false,
    isUncertain: false,
    actionsDisabled: false,
    serverClockOffsetMs: 0,
    waitingCount: 3,
    actionError: null,
    syncError: null,
    requestCall: vi.fn(),
    requestStartService: vi.fn(),
    requestClose: vi.fn(),
    cancelClose: vi.fn(),
    confirmClose: vi.fn(),
    requestNoShow: vi.fn(),
    cancelNoShow: vi.fn(),
    confirmNoShow: vi.fn(),
    refresh: vi.fn(),
    reconcile: vi.fn(),
    ...overrides,
  };
}

describe('MiCubiculo · Dispensación y Resolución 1604 MinSalud (SCR-CAJ-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. En estado IN_SERVICE muestra campo para lectura de Fórmula Médica / MIPRES', () => {
    const workspace = createMockWorkspace();
    render(
      <Theme>
        <MiCubiculo workspace={workspace} />
      </Theme>,
    );

    expect(screen.getByText('Fórmula Médica / MIPRES')).toBeDefined();
    expect(
      screen.getByPlaceholderText('Escanee código de barras de fórmula o digite MIPRES...'),
    ).toBeDefined();

    const input = screen.getByPlaceholderText(
      'Escanee código de barras de fórmula o digite MIPRES...',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'MIPRES-2026-999' } });
    expect(input.value).toBe('MIPRES-2026-999');
  });

  it('2. En CONFIRM_CLOSE presenta selector de Entrega Total vs Pendiente 48h con aviso legal', async () => {
    const confirmCloseMock = vi.fn();
    const workspace = createMockWorkspace({
      step: 'CONFIRM_CLOSE',
      confirmClose: confirmCloseMock,
    });

    render(
      <Theme>
        <MiCubiculo workspace={workspace} />
      </Theme>,
    );

    // Opciones de resolución
    expect(screen.getByText('Entrega Total (PBS)')).toBeDefined();
    expect(screen.getByText('Generar Pendiente 48h')).toBeDefined();

    // Seleccionar Pendiente 48h
    fireEvent.click(screen.getByText('Generar Pendiente 48h'));

    // Debe mostrar la promesa de garantía legal según Res. 1604
    expect(screen.getByText(/Garantía Legal de Entrega ≤ 48 Horas/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Cra 43A # 12-45/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/300 123 4567/i)).toBeDefined();

    // Si se pulsa cerrar sin llenar dirección ni teléfono, muestra error y no llama a confirmClose
    fireEvent.click(screen.getByRole('button', { name: /Cerrar turno y liberar cubículo/i }));
    expect(
      screen.getByText(/Para radicar un pendiente 48h \(Res\. 1604\) debe ingresar dirección/i),
    ).toBeDefined();
    expect(confirmCloseMock).not.toHaveBeenCalled();

    // Llenar dirección y teléfono
    fireEvent.change(screen.getByPlaceholderText(/Cra 43A # 12-45/i), {
      target: { value: 'Av. El Dorado # 68-50, Apto 501' },
    });
    fireEvent.change(screen.getByPlaceholderText(/300 123 4567/i), {
      target: { value: '3157778899' },
    });

    // Ahora sí envía confirmClose con payload de pendiente 48h
    fireEvent.click(screen.getByRole('button', { name: /Cerrar turno y liberar cubículo/i }));
    expect(confirmCloseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: DispensationResolution.PENDING_48H,
        deliveryAddress: 'Av. El Dorado # 68-50, Apto 501',
        deliveryPhone: '3157778899',
        itemsPendingCount: 1,
      }),
    );
  });
});
