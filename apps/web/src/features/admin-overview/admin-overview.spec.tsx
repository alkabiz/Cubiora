import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  it('renderiza la tarjeta reactiva de Cuello de Botella cuando se detecta congestión', () => {
    vi.spyOn(telemetryHook, 'useOperationalTelemetry').mockReturnValue({
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
      },
      slaAlert: {
        isActive: false,
        worstCubicleCode: null,
        worstCubicleDisplay: null,
        affectedTicketCode: null,
        elapsedSeconds: null,
        thresholdSeconds: 720,
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
      sendBroadcastNotice: vi.fn(),
    });

    renderWithProviders(<AdminOverviewScreen />);

    const card = screen.getByTestId('bottleneck-recommendation-card');
    expect(card).toBeDefined();
    expect(within(card).getByText('Cuello de Botella Detectado')).toBeDefined();
    expect(
      within(card).getByText(/cuello de botella detectado en alto costo \/ mipres/i),
    ).toBeDefined();
    expect(within(card).getByText('Reasignar [Cubículo 01] a Alto Costo / MIPRES')).toBeDefined();
  });
});
