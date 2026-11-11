// ─── [SCR-PUB-001] Tests Unitarios del Monitor Público de Sala ────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import { PublicDisplayScreen } from './public-display-screen';

const renderComponent = () => {
  return render(
    <Theme accentColor="blue" grayColor="slate">
      <MemoryRouter>
        <PublicDisplayScreen />
      </MemoryRouter>
    </Theme>,
  );
};

describe('[SCR-PUB-001] Monitor Público de Llamado de Turnos (10-Foot UI)', () => {
  let originalFetch: typeof window.fetch;
  let sseListeners: Record<string, Array<(e: MessageEvent) => void>>;

  beforeEach(() => {
    originalFetch = window.fetch;
    sseListeners = {};

    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          currentCall: {
            ticketCode: 'TUR-000034-GE',
            cubicleName: 'Cubículo 03',
            priority: 'GENERAL',
            calledAtIso: new Date().toISOString(),
          },
          recentCalls: [
            { ticketCode: 'TUR-000033-GE', cubicleName: 'Cubículo 03', priority: 'GENERAL' },
            { ticketCode: 'TUR-000032-GE', cubicleName: 'Cubículo 03', priority: 'GENERAL' },
            { ticketCode: 'TUR-000031-GE', cubicleName: 'Cubículo 03', priority: 'GENERAL' },
            { ticketCode: 'TUR-000030-GE', cubicleName: 'Cubículo 03', priority: 'GENERAL' },
          ],
          activeNotice: null,
        },
      }),
    });

    // Mock constructible de EventSource para Vitest v5 capturando suscriptores SSE
    class MockEventSource {
      onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
      onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
      addEventListener(event: string, cb: (e: MessageEvent) => void) {
        if (!sseListeners[event]) sseListeners[event] = [];
        sseListeners[event]!.push(cb);
      }
      removeEventListener() {}
      close() {}
    }
    (globalThis as unknown as { EventSource: unknown }).EventSource = MockEventSource;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Renderiza el turno principal activo (TUR-000034-GE), instrucción y el cubículo asignado (Cubículo 03)', async () => {
    renderComponent();

    // Marca y Cabecera
    expect(screen.getByText('Cubiora')).toBeDefined();
    expect(screen.getByText('Turnos')).toBeDefined();

    // Turno principal activo hidratado desde snapshot
    expect(await screen.findByText('TUR-000034-GE')).toBeDefined();
    expect(screen.getByText('TURNO LLAMADO')).toBeDefined();
    expect(screen.getByText('Diríjase al')).toBeDefined();
    expect(screen.getAllByText('Cubículo 03').length).toBeGreaterThan(0);
    expect(screen.getByText('EN LÍNEA')).toBeDefined();
  });

  it('2. Garantiza región accesible con aria-live="assertive" para anuncio a lectores de pantalla', async () => {
    renderComponent();

    await screen.findByText('TUR-000034-GE');

    const heroRegion = screen.getByRole('region', { name: /Turno llamado actualmente/i });
    expect(heroRegion).toBeDefined();
    expect(heroRegion.getAttribute('aria-live')).toBe('assertive');
    expect(heroRegion.getAttribute('aria-atomic')).toBe('true');
    expect(
      screen.getByText(/Atención: Turno TUR-000034-GE, por favor pasar al Cubículo 03/i),
    ).toBeDefined();
  });

  it('3. Renderiza la lista LLAMADOS RECIENTES con separación estructural evitando colisiones de texto', async () => {
    renderComponent();

    await screen.findByText('TUR-000034-GE');

    // Cabecera de la sección
    expect(screen.getByText('Llamados recientes')).toBeDefined();

    // Códigos de los 4 turnos recientes
    expect(screen.getByText('TUR-000033-GE')).toBeDefined();
    expect(screen.getByText('TUR-000032-GE')).toBeDefined();
    expect(screen.getByText('TUR-000031-GE')).toBeDefined();
    expect(screen.getByText('TUR-000030-GE')).toBeDefined();

    // Verifica que cada ítem de lista tenga estructura flex items-center justify-between
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(4);

    listItems.forEach((li) => {
      expect(li.className).toContain('justify-between');
      expect(li.className).toContain('items-center');
    });
  });

  it('4. Conmuta el botón de audio entre "Sonido desactivado" y "Sonido activo"', async () => {
    renderComponent();
    await screen.findByText('TUR-000034-GE');

    // Inicialmente desactivado con estilo de advertencia para desbloqueo
    const soundBtn = screen.getByRole('button', { name: /Sonido desactivado/i });
    expect(soundBtn).toBeDefined();

    // Click para activar sonido
    fireEvent.click(soundBtn);
    expect(screen.getByText(/Sonido activo/i)).toBeDefined();

    // Click para silenciar
    fireEvent.click(screen.getByRole('button', { name: /Sonido activo/i }));
    expect(screen.getByText(/Sonido desactivado/i)).toBeDefined();
  });

  it('5. Cumple con la política Cero PII en toda la superficie de la pantalla pública', async () => {
    const { container } = renderComponent();
    await screen.findByText('TUR-000034-GE');

    const html = container.innerHTML;
    expect(html).not.toMatch(/paciente/i);
    expect(html).not.toMatch(/cédula/i);
    expect(html).not.toMatch(/documento/i);
    expect(html).not.toMatch(/identificación/i);
  });

  it('6. Muestra SALA DE ESPERA y "Sin llamados previos" cuando el snapshot inicial está vacío', async () => {
    window.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          currentCall: null,
          recentCalls: [],
          activeNotice: null,
        },
      }),
    });

    renderComponent();

    expect(await screen.findByText('SALA DE ESPERA')).toBeDefined();
    expect(screen.getByText('Sin llamados previos')).toBeDefined();
    expect(screen.queryByText('TUR-000034-GE')).toBeNull();
  });

  it('7. Cambia el indicador a DESCONECTADO (OFFLINE) y no inventa turnos cuando falla la API', async () => {
    window.fetch = vi.fn().mockRejectedValueOnce(new Error('Network offline'));

    renderComponent();

    expect(await screen.findByText('DESCONECTADO')).toBeDefined();
    expect(screen.getByText('SALA DE ESPERA')).toBeDefined();
    expect(screen.queryByText('TUR-000034-GE')).toBeNull();
  });

  it('8. Muestra aviso general institucional recibido por SSE ("admin.notice") sin exponer PII', async () => {
    renderComponent();
    await screen.findByText('TUR-000034-GE');

    expect(sseListeners['admin.notice']?.length).toBeGreaterThan(0);

    await act(async () => {
      for (const listener of sseListeners['admin.notice'] ?? []) {
        listener(
          new MessageEvent('admin.notice', {
            data: JSON.stringify({
              message: 'Prioridad de turno para adultos mayores en Cubículo 01',
              severity: 'warning',
              issuedAtIso: new Date().toISOString(),
              expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
            }),
          }),
        );
      }
    });

    await waitFor(() => {
      expect(
        screen.getByText('Prioridad de turno para adultos mayores en Cubículo 01'),
      ).toBeDefined();
    });
  });
});

