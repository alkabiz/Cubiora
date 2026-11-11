import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import { AdminOverviewScreen } from './admin-overview-screen';
import * as telemetryHook from './use-operational-telemetry';

describe('AdminOverviewScreen · Escalabilidad Mega-Centro y Prescripción de Cuello de Botella (Fase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <Theme accentColor="teal" grayColor="slate">
        <MemoryRouter>{ui}</MemoryRouter>
      </Theme>,
    );
  };

  it('permite alternar entre Vista Estándar (2 col) y Vista Compacta Mega-Centro (3-4 col)', () => {
    renderWithProviders(<AdminOverviewScreen />);

    const standardBtn = screen.getByRole('button', { name: /estándar \(2 col\)/i });
    const compactBtn = screen.getByRole('button', { name: /compacta mega-centro/i });

    expect(standardBtn.getAttribute('aria-pressed')).toBe('true');
    expect(compactBtn.getAttribute('aria-pressed')).toBe('false');

    // Cambiar a vista compacta
    fireEvent.click(compactBtn);
    expect(compactBtn.getAttribute('aria-pressed')).toBe('true');
    expect(standardBtn.getAttribute('aria-pressed')).toBe('false');

    // Volver a vista estándar
    fireEvent.click(standardBtn);
    expect(standardBtn.getAttribute('aria-pressed')).toBe('true');
    expect(compactBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('renderiza la tarjeta reactiva de Cuello de Botella cuando se detecta congestión y datos reales sin mocks', () => {
    vi.spyOn(telemetryHook, 'useOperationalTelemetry').mockReturnValue({
      facilityCode: 'SEDE-CEN-01',
      facilityName: 'Sede Central',
      slaThresholdSeconds: 600,
      isLoaded: true,
      cubicles: [],
      queue: [],
      kpis: {
        waitingCount: 5,
        activeCubicles: 2,
        totalCubicles: 3,
        closedTodayCount: 20,
        slaCompliancePercentage: 95.0,
        noShowTodayCount: 0,
        noShowRate: 0,
        averageWaitSeconds: 980,
        averageServiceSeconds: 310,
      },
      slaAlert: {
        isActive: false,
        worstCubicleCode: null,
        worstCubicleDisplay: null,
        affectedTicketCode: null,
        elapsedSeconds: null,
        thresholdSeconds: 600,
        slaCompliancePercentage: 95.0,
      },
      bottleneckRecommendation: {
        detected: true,
        congestedCategory: 'HIGH_COST',
        averageWaitSeconds: 980,
        pendingCount: 4,
        suggestedIdleCubicleCode: 'CUB-01',
        suggestedAction: 'Reasignar [Cubículo 01] a Alto Costo / MIPRES',
        message: 'Cuello de botella detectado en Alto Costo / MIPRES. Se sugiere reasignar [Cubículo 01].',
      },
      hourlyFlow: [],
      connectionStatus: 'connected',
      latencyMs: 12,
      forceRefresh: vi.fn(),
      sendBroadcastNotice: vi.fn().mockReturnValue(true),
    });

    renderWithProviders(<AdminOverviewScreen />);

    expect(screen.getByText('SEDE-CEN-01')).toBeDefined();
    expect(screen.getByText('SLA ≤ 10 min')).toBeDefined();
    expect(screen.queryByText('DISP-CENTRAL')).toBeNull();
    expect(screen.queryByText('98.2%')).toBeNull();
    expect(screen.queryByText('±42s')).toBeNull();

    const card = screen.getByTestId('bottleneck-recommendation-card');
    expect(card).toBeDefined();
    expect(within(card).getByText('Cuello de Botella Detectado')).toBeDefined();
    expect(
      within(card).getByText(/cuello de botella detectado en alto costo \/ mipres/i),
    ).toBeDefined();
    expect(within(card).getByText('Reasignar [Cubículo 01] a Alto Costo / MIPRES')).toBeDefined();
  });

  it('muestra valores vacíos honestos y alerta OFFLINE cuando la telemetría está sin conexión', () => {
    vi.spyOn(telemetryHook, 'useOperationalTelemetry').mockReturnValue({
      facilityCode: null,
      facilityName: null,
      slaThresholdSeconds: null,
      isLoaded: false,
      cubicles: [],
      queue: [],
      kpis: {
        waitingCount: 0,
        activeCubicles: 0,
        totalCubicles: 0,
        closedTodayCount: 0,
        slaCompliancePercentage: null,
        noShowTodayCount: 0,
        noShowRate: null,
        averageWaitSeconds: null,
        averageServiceSeconds: null,
      },
      slaAlert: {
        isActive: false,
        worstCubicleCode: null,
        worstCubicleDisplay: null,
        affectedTicketCode: null,
        elapsedSeconds: null,
        thresholdSeconds: 0,
        slaCompliancePercentage: null,
      },
      bottleneckRecommendation: null,
      hourlyFlow: [],
      connectionStatus: 'offline',
      latencyMs: null,
      forceRefresh: vi.fn(),
      sendBroadcastNotice: vi.fn().mockReturnValue(false),
    });

    renderWithProviders(<AdminOverviewScreen />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/Telemetría sin conexión en vivo \(OFFLINE\)/i)).toBeDefined();
    expect(screen.getByText('0%')).toBeDefined();
    expect(screen.getByText('Offline')).toBeDefined();
    expect(screen.queryByText('98.2%')).toBeNull();
    expect(screen.queryByText('1.33%')).toBeNull();
    expect(screen.queryByText('DISP-CENTRAL')).toBeNull();
  });

  it('abre BroadcastNoticeDialog al pulsar "Aviso General", valida mensaje corto, envía mensaje personalizado y maneja desconexión WebSocket', async () => {
    const sendBroadcastNoticeMock = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    vi.spyOn(telemetryHook, 'useOperationalTelemetry').mockReturnValue({
      facilityCode: 'SEDE-CEN-01',
      facilityName: 'Sede Central',
      slaThresholdSeconds: 600,
      isLoaded: true,
      cubicles: [],
      queue: [],
      kpis: {
        waitingCount: 2,
        activeCubicles: 1,
        totalCubicles: 2,
        closedTodayCount: 5,
        slaCompliancePercentage: 100,
        noShowTodayCount: 0,
        noShowRate: 0,
        averageWaitSeconds: 120,
        averageServiceSeconds: 180,
      },
      slaAlert: {
        isActive: false,
        worstCubicleCode: null,
        worstCubicleDisplay: null,
        affectedTicketCode: null,
        elapsedSeconds: null,
        thresholdSeconds: 600,
        slaCompliancePercentage: 100,
      },
      bottleneckRecommendation: null,
      hourlyFlow: [],
      connectionStatus: 'connected',
      latencyMs: 15,
      forceRefresh: vi.fn(),
      sendBroadcastNotice: sendBroadcastNoticeMock,
    });

    renderWithProviders(<AdminOverviewScreen />);

    // Abrir modal sin usar window.prompt
    fireEvent.click(screen.getByRole('button', { name: /aviso general/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Emitir Aviso General a Sala')).toBeDefined();

    const messageInput = within(dialog).getByLabelText(/mensaje para pantallas de sala/i) as HTMLTextAreaElement;
    // Validar mensaje demasiado corto (< 5 caracteres)
    fireEvent.change(messageInput, { target: { value: 'Hola' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /emitir aviso en sala/i }));

    expect(await within(dialog).findByText('El mensaje debe contener al menos 5 caracteres.')).toBeDefined();
    expect(sendBroadcastNoticeMock).not.toHaveBeenCalled();

    // Enviar mensaje válido
    fireEvent.change(messageInput, { target: { value: 'Priorizar entregas de Alto Costo en ventanilla 2.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /emitir aviso en sala/i }));

    await waitFor(() => {
      expect(sendBroadcastNoticeMock).toHaveBeenCalledWith(
        'Priorizar entregas de Alto Costo en ventanilla 2.',
        'info',
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Reabrir y simular fallo cuando sendBroadcastNotice devuelve false
    fireEvent.click(screen.getByRole('button', { name: /aviso general/i }));
    const retryDialog = await screen.findByRole('dialog');
    fireEvent.click(within(retryDialog).getByRole('button', { name: /emitir aviso en sala/i }));

    expect(
      await within(retryDialog).findByText(
        'Sin conexión WebSocket activa: no fue posible emitir el aviso general.',
      ),
    ).toBeDefined();
  });
});
