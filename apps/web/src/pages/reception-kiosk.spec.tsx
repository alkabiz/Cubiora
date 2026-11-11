import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import { ReceptionPage } from './reception-page';
import { QueueCategory, TicketStatus } from '@cubiora/shared';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <Theme accentColor="blue" grayColor="slate">
      <MemoryRouter>{ui}</MemoryRouter>
    </Theme>,
  );
};

describe('ReceptionPage · Quiosco Táctil de Autoservicio y Categorías Farmacéuticas (Fase 5)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      }),
    );
  });

  it('debe renderizar las 4 categorías operativas de dispensación farmacéutica', () => {
    renderWithTheme(<ReceptionPage />);

    expect(screen.getByText('Turno general')).toBeDefined();
    expect(screen.getByText('Atención preferencial')).toBeDefined();
    expect(screen.getByText('Alto Costo / MIPRES')).toBeDefined();
    expect(screen.getByText('Facturación y Copagos')).toBeDefined();
  });

  it('permite seleccionar Alto Costo / MIPRES y Facturación y Copagos', () => {
    renderWithTheme(<ReceptionPage />);

    const radioHighCost = screen.getByRole('radio', { name: /alto costo \/ mipres/i });
    const radioBilling = screen.getByRole('radio', { name: /facturación y copagos/i });

    expect(radioHighCost.getAttribute('aria-checked')).toBe('false');
    expect(radioBilling.getAttribute('aria-checked')).toBe('false');

    // Seleccionar Alto Costo
    fireEvent.click(radioHighCost);
    expect(radioHighCost.getAttribute('aria-checked')).toBe('true');
    expect(radioBilling.getAttribute('aria-checked')).toBe('false');

    // Seleccionar Facturación
    fireEvent.click(radioBilling);
    expect(radioBilling.getAttribute('aria-checked')).toBe('true');
    expect(radioHighCost.getAttribute('aria-checked')).toBe('false');
  });

  it('simula la captura de cédula mediante el escáner de código de barras / PDF417', () => {
    renderWithTheme(<ReceptionPage />);

    const docInput = screen.getByLabelText(/documento/i) as HTMLInputElement;
    expect(docInput.value).toBe('');

    const scanBtn = screen.getByRole('button', { name: /escanear cédula/i });
    fireEvent.click(scanBtn);

    expect(docInput.value).toBe('1023456789');
  });

  it('permite desplegar el teclado numérico táctil y digitar números tocando la pantalla', () => {
    renderWithTheme(<ReceptionPage />);

    const docInput = screen.getByLabelText(/documento/i) as HTMLInputElement;

    // Desplegar teclado táctil y verificar aria-expanded / aria-controls
    const keypadToggle = screen.getByRole('button', { name: /teclado táctil/i });
    expect(keypadToggle.getAttribute('aria-expanded')).toBe('false');
    expect(keypadToggle.getAttribute('aria-controls')).toBe('touch-numeric-keypad');
    fireEvent.click(keypadToggle);
    expect(keypadToggle.getAttribute('aria-expanded')).toBe('true');

    const keypad = screen.getByTestId('touch-numeric-keypad');
    expect(keypad.id).toBe('touch-numeric-keypad');
    expect(keypad).toBeDefined();

    // Digitar dígitos: 1, 2, 3
    fireEvent.click(within(keypad).getByRole('button', { name: '1' }));
    fireEvent.click(within(keypad).getByRole('button', { name: '2' }));
    fireEvent.click(within(keypad).getByRole('button', { name: '3' }));
    expect(docInput.value).toBe('123');

    // Botón Borrar: borra el '3'
    fireEvent.click(within(keypad).getByRole('button', { name: 'Borrar' }));
    expect(docInput.value).toBe('12');

    // Botón Limpiar en el teclado táctil: borra todo
    fireEvent.click(within(keypad).getByRole('button', { name: 'Limpiar' }));
    expect(docInput.value).toBe('');

    // Ocultar teclado
    fireEvent.click(within(keypad).getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByTestId('touch-numeric-keypad')).toBeNull();
    expect(keypadToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('mapea correctamente categorías HIGH_COST/BILLING y estados CLOSED/NO_SHOW en último turno y tabla reciente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                publicCode: 'TUR-000501-AC',
                status: TicketStatus.CLOSED,
                queueCategory: QueueCategory.HIGH_COST,
                cubicleDisplayName: 'Cubículo 02',
                createdAt: '2026-11-11T10:15:00.000Z',
              },
              {
                publicCode: 'TUR-000500-FA',
                status: TicketStatus.NO_SHOW,
                queueCategory: QueueCategory.BILLING,
                cubicleDisplayName: 'Cubículo 01',
                createdAt: '2026-11-11T10:05:00.000Z',
              },
            ],
          }),
      }),
    );

    renderWithTheme(<ReceptionPage />);

    const table = await screen.findByRole('table');
    await waitFor(() => {
      expect(screen.getAllByText('TUR-000501-AC').length).toBeGreaterThanOrEqual(2);
    });

    // Verificar tabla reciente
    expect(within(table).getByText('Alto Costo')).toBeDefined();
    expect(within(table).getByText('Cerrado')).toBeDefined();
    expect(within(table).getByText('Facturación')).toBeDefined();
    expect(within(table).getByText('No presentado')).toBeDefined();

    // Verificar tarjeta de último turno generado
    const lastTicketHeading = screen.getByText('Último turno generado');
    const lastTicketCard = lastTicketHeading.closest('.rt-Card') as HTMLElement;
    expect(lastTicketCard).not.toBeNull();
    expect(within(lastTicketCard).getByText('Alto Costo / MIPRES')).toBeDefined();
    expect(within(lastTicketCard).getByText('Cerrado')).toBeDefined();
  });
});
