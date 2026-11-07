// ─── [SCR-ADM-002] Tests Unitarios de Configuración de Cubículos ──────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import { AdminCubiclesScreen } from './admin-cubicles-screen';
import { apiClient } from '../../lib/api';

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

// Mock de apiClient
vi.mock('../../lib/api', () => ({
  apiClient: vi.fn().mockResolvedValue({ success: true, data: { id: 'CUB-01', operatorName: 'Test' } }),
}));

const renderComponent = () => {
  return render(
    <Theme accentColor="teal" grayColor="slate">
      <MemoryRouter>
        <AdminCubiclesScreen />
      </MemoryRouter>
    </Theme>,
  );
};

describe('[SCR-ADM-002] Administración · Configuración de Cubículos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renderiza el Header superior con breadcrumbs, título principal y botón de regreso', () => {
    renderComponent();

    // Breadcrumb
    expect(screen.getByText('SCR-ADM-002')).toBeDefined();
    expect(screen.getByText('Parametrización de Puestos y Ventanillas')).toBeDefined();

    // Título Principal
    expect(
      screen.getByText('[SCR-ADM-002] Administración · Configuración de Cubículos'),
    ).toBeDefined();

    // Botón secundario Volver al Panel General
    expect(screen.getByText('← Volver al Panel General')).toBeDefined();
  });

  it('2. Renderiza los 5 cubículos con sus nombres, números y módulos', () => {
    renderComponent();

    expect(screen.getByText('Cubículo 01')).toBeDefined();
    expect(screen.getByText('Cubículo 02')).toBeDefined();
    expect(screen.getByText('Cubículo 03')).toBeDefined();
    expect(screen.getByText('Cubículo 04')).toBeDefined();
    expect(screen.getByText('Cubículo 05')).toBeDefined();

    // Números de estación
    expect(screen.getByText('01')).toBeDefined();
    expect(screen.getByText('02')).toBeDefined();
    expect(screen.getByText('03')).toBeDefined();
    expect(screen.getByText('04')).toBeDefined();
    expect(screen.getByText('05')).toBeDefined();

    // Módulos
    expect(screen.getAllByText('Módulo MOD-A').length).toBe(2);
    expect(screen.getAllByText('Módulo MOD-B').length).toBe(2);
    expect(screen.getByText('Módulo MOD-C')).toBeDefined();
  });

  it('3. Renderiza los 5 badges semánticos de estado unificados en español institucional', () => {
    renderComponent();

    expect(screen.getByText('ATENDIENDO')).toBeDefined();
    expect(screen.getByText('SLA EXCEDIDO')).toBeDefined();
    expect(screen.getByText('LLAMANDO')).toBeDefined();
    expect(screen.getByText('DISPONIBLE')).toBeDefined();
    expect(screen.getByText('INACTIVO')).toBeDefined();
  });

  it('4. Renderiza los valores iniciales de Farmacéutico Asignado, Umbral SLA y Turnos atendidos hoy', () => {
    renderComponent();

    // Inputs de farmacéutico asignado
    expect(screen.getByDisplayValue('Lic. M. Arismendi')).toBeDefined();
    expect(screen.getByDisplayValue('Farm. J. Duarte')).toBeDefined();
    expect(screen.getByDisplayValue('Lic. R. Mendoza')).toBeDefined();
    expect(screen.getByDisplayValue('Farm. S. Quintero')).toBeDefined();
    expect(screen.getByDisplayValue('Farm. Auxiliar Guardia')).toBeDefined();

    // Umbrales SLA
    expect(screen.getAllByText('12 min').length).toBe(5);

    // Contadores de turnos
    expect(screen.getByText('38 turnos')).toBeDefined();
    expect(screen.getByText('34 turnos')).toBeDefined();
    expect(screen.getByText('41 turnos')).toBeDefined();
    expect(screen.getByText('35 turnos')).toBeDefined();
    expect(screen.getByText('0 turnos')).toBeDefined();
  });

  it('5. Permite editar el input de Farmacéutico Asignado y actualiza el estado local', () => {
    renderComponent();

    const input = screen.getByDisplayValue('Lic. M. Arismendi') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Dra. Carolina Méndez' } });

    expect(screen.getByDisplayValue('Dra. Carolina Méndez')).toBeDefined();
    expect(screen.queryByDisplayValue('Lic. M. Arismendi')).toBeNull();
  });

  it('6. Desactiva un cubículo activo al pulsar "Desactivar": pasa a INACTIVO, Deshabilitado y botón Habilitar', () => {
    renderComponent();

    // Cubículo 01 está activo inicialmente con botón "Desactivar" y footer "Operativo en cola"
    expect(screen.getByText('ATENDIENDO')).toBeDefined();
    const deactivateButtons = screen.getAllByRole('button', { name: /Desactivar/i });
    expect(deactivateButtons.length).toBe(4);

    // Desactivar Cubículo 01
    fireEvent.click(deactivateButtons[0]!);

    // Ahora el Cubículo 01 debe pasar a INACTIVO
    expect(screen.queryByText('ATENDIENDO')).toBeNull();
    expect(screen.getAllByText('INACTIVO').length).toBe(2); // CUB-01 y CUB-05

    // Debe haber 2 botones "Habilitar" (CUB-01 y CUB-05) y 3 "Desactivar"
    expect(screen.getAllByRole('button', { name: /Habilitar/i }).length).toBe(2);
    expect(screen.getAllByRole('button', { name: /Desactivar/i }).length).toBe(3);
    expect(screen.getAllByText('Deshabilitado').length).toBe(2);
  });

  it('7. Habilita un cubículo inactivo al pulsar "Habilitar": pasa a DISPONIBLE, Operativo en cola y botón Desactivar', () => {
    renderComponent();

    // Cubículo 05 está inactivo con botón "Habilitar" y footer "Deshabilitado"
    const enableButton = screen.getByRole('button', { name: /Habilitar/i });
    expect(enableButton).toBeDefined();

    fireEvent.click(enableButton);

    // Cubículo 05 pasa a DISPONIBLE y Operativo en cola
    expect(screen.getAllByText('DISPONIBLE').length).toBe(2); // CUB-04 y CUB-05
    expect(screen.queryByRole('button', { name: /Habilitar/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Desactivar/i }).length).toBe(5);
    expect(screen.getAllByText('Operativo en cola').length).toBe(5);
  });

  it('8. Muestra retroalimentación accesible de guardado al modificar o desenfocar el campo (WCAG 4.1.3 AA)', async () => {
    vi.useFakeTimers();
    renderComponent();

    const input = screen.getByDisplayValue('Lic. M. Arismendi') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Dra. Elena Ramos' } });

    // Avance de tiempo inferior a 600ms no dispara aún el guardado
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText('Guardando…')).toBeNull();

    // Avance tras los 600ms de debounce activa el guardado
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(apiClient).toHaveBeenCalledWith(
      '/cubicles/CUB-01/operator',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ operatorName: 'Dra. Elena Ramos' }),
      }),
    );

    vi.useRealTimers();
  });

  it('9. Guarda inmediatamente al perder el foco (blur) sin esperar al temporizador de debounce', async () => {
    renderComponent();

    const input = screen.getByDisplayValue('Lic. M. Arismendi') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Dr. Roberto Gómez' } });

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(apiClient).toHaveBeenCalledWith(
      '/cubicles/CUB-01/operator',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ operatorName: 'Dr. Roberto Gómez' }),
      }),
    );
  });

  it('10. Muestra "Error al guardar" con botón de reintento que preserva el valor escrito ante fallo del servidor', async () => {
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('Network error'));
    renderComponent();

    const input = screen.getByDisplayValue('Lic. M. Arismendi') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Lic. Fallo Conexión' } });

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(screen.getByText('Error al guardar')).toBeDefined();
    const retryBtn = screen.getByRole('button', { name: 'Reintentar' });
    expect(retryBtn).toBeDefined();

    // El input mantiene intacto el valor tipeado por el usuario
    expect(input.value).toBe('Lic. Fallo Conexión');

    // Al reintentar con éxito
    vi.mocked(apiClient).mockResolvedValueOnce({ success: true, data: { id: 'CUB-01', operatorName: 'Lic. Fallo Conexión' } });
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(apiClient).toHaveBeenCalledTimes(2);
  });
});
