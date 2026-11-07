// ─── [SCR-PUB-001] Tests Unitarios del Monitor Público de Sala ────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import { PublicDisplayScreen } from './public-display-screen';

const renderComponent = () => {
  return render(
    <Theme accentColor="teal" grayColor="slate">
      <MemoryRouter>
        <PublicDisplayScreen />
      </MemoryRouter>
    </Theme>,
  );
};

describe('[SCR-PUB-001] Monitor Público de Llamado de Turnos (10-Foot UI)', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
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
        },
      }),
    });

    // Mock de EventSource
    (globalThis as unknown as { EventSource: unknown }).EventSource = vi
      .fn()
      .mockImplementation(() => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onerror: null,
      }));
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

    // Turno principal activo
    expect(screen.getByText('TURNO LLAMADO')).toBeDefined();
    expect(screen.getByText('TUR-000034-GE')).toBeDefined();
    expect(screen.getByText('Diríjase al')).toBeDefined();
    expect(screen.getAllByText('Cubículo 03').length).toBeGreaterThan(0);
  });

  it('2. Garantiza región accesible con aria-live="assertive" para anuncio a lectores de pantalla', () => {
    renderComponent();

    const heroRegion = screen.getByRole('region', { name: /Turno llamado actualmente/i });
    expect(heroRegion).toBeDefined();
    expect(heroRegion.getAttribute('aria-live')).toBe('assertive');
    expect(heroRegion.getAttribute('aria-atomic')).toBe('true');
    expect(
      screen.getByText(/Atención: Turno TUR-000034-GE, por favor pasar al Cubículo 03/i),
    ).toBeDefined();
  });

  it('3. Renderiza la lista LLAMADOS RECIENTES con separación estructural evitando colisiones de texto', () => {
    renderComponent();

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

  it('4. Conmuta el botón de audio entre "Sonido desactivado" y "Sonido activo"', () => {
    renderComponent();

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

  it('5. Cumple con la política Cero PII en toda la superficie de la pantalla pública', () => {
    const { container } = renderComponent();
    const html = container.innerHTML;

    expect(html).not.toMatch(/paciente/i);
    expect(html).not.toMatch(/cédula/i);
    expect(html).not.toMatch(/documento/i);
    expect(html).not.toMatch(/identificación/i);
  });
});

