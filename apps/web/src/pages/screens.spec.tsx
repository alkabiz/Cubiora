import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import { ReceptionPage } from './reception-page';
import { CashierPage } from './cashier-page';
import { DisplayPage } from './display-page';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <Theme accentColor="teal" grayColor="slate">
      <MemoryRouter>{ui}</MemoryRouter>
    </Theme>,
  );
};

describe('Contrato Aprobado de Cubiora — Suite de Pantallas', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('SCR-REC-001: Recepción', () => {
    it('debe mostrar el estado inicial correctamente sin turnos generados', () => {
      renderWithTheme(<ReceptionPage />);

      // Encabezado institucional
      expect(screen.getByText('Cubiora')).toBeDefined();
      expect(screen.getByText('Recepción')).toBeDefined();
      expect(screen.getByText('En línea')).toBeDefined();

      // Formulario
      expect(screen.getByRole('heading', { name: /Generar turno/i })).toBeDefined();
      expect(screen.getByPlaceholderText(/Ingrese nombre y apellido/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Ej\. 1023456789/i)).toBeDefined();

      // Panel inicial vacío
      expect(screen.getByText(/Aún no has generado ningún turno en esta sesión/i)).toBeDefined();
    });

    it('debe mantener el botón "Generar turno" deshabilitado cuando el nombre está vacío', () => {
      renderWithTheme(<ReceptionPage />);

      const submitButton = screen.getByRole('button', { name: /Generar turno/i });
      expect(submitButton).toBeDefined();
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);

      const nameInput = screen.getByPlaceholderText(/Ingrese nombre y apellido/i);
      fireEvent.change(nameInput, { target: { value: 'Juan Pérez' } });

      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    it('debe generar un turno en formato TUR-XXXXXX-YY y reflejar estados PENDING, ASSIGNED o CALLED', async () => {
      vi.useFakeTimers();
      renderWithTheme(<ReceptionPage />);

      const nameInput = screen.getByPlaceholderText(/Ingrese nombre y apellido/i);
      const submitButton = screen.getByRole('button', { name: /Generar turno/i });

      fireEvent.change(nameInput, { target: { value: 'Ana Gómez' } });
      fireEvent.click(submitButton);

      // Bloqueo de doble envío durante submit
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // El código emitido debe cumplir con el formato TUR-
      const ticketCodes = screen.getAllByText(/TUR-\d{6}-[A-Z0-9]{2}/);
      expect(ticketCodes.length).toBeGreaterThanOrEqual(1);

      // El badge de estado debe ser visible
      expect(screen.getAllByText(/Asignado|En espera|Llamado/).length).toBeGreaterThanOrEqual(1);

      vi.useRealTimers();
    });

    it('debe mantener un límite máximo de tres turnos en la tabla reciente', async () => {
      vi.useFakeTimers();
      renderWithTheme(<ReceptionPage />);

      const nameInput = screen.getByPlaceholderText(/Ingrese nombre y apellido/i);
      const submitButton = screen.getByRole('button', { name: /Generar turno/i });

      // Generar 4 turnos sucesivos
      for (let i = 1; i <= 4; i++) {
        fireEvent.change(nameInput, { target: { value: `Paciente ${i}` } });
        fireEvent.click(submitButton);
        act(() => {
          vi.advanceTimersByTime(300);
        });
      }

      // La tabla solo debe contener hasta 3 filas en el cuerpo
      const tableRows = screen.getAllByRole('row');
      // 1 encabezado + máx 3 filas de datos = máx 4 filas en total
      expect(tableRows.length).toBeLessThanOrEqual(4);

      vi.useRealTimers();
    });

    it('no debe incluir textos ni controles obsoletos (FarmaTurnos PMV, Registro de Turno Presencial, T-XXX, QR)', () => {
      const { container } = renderWithTheme(<ReceptionPage />);
      const html = container.innerHTML;

      expect(html).not.toContain('FarmaTurnos');
      expect(html).not.toContain('Registro de Turno Presencial');
      expect(html).not.toMatch(/T-\d{3}/);
      expect(html).not.toContain('Código QR');
      expect(html).not.toContain('Imprimir');
    });
  });

  describe('SCR-CAJ-001: Mi Cubículo (Caja)', () => {
    it('debe iniciar en ASSIGNED con número TUR-, paciente, hora y acción "Llamar turno"', () => {
      renderWithTheme(<CashierPage />);

      expect(screen.getByText('Cubiora')).toBeDefined();
      expect(screen.getAllByText('Mi cubículo').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Cubículo 03')).toBeDefined();
      expect(screen.getByText('TUR-000124-C3')).toBeDefined();
      expect(screen.getByText(/Carlos Pérez/)).toBeDefined();
      expect(screen.getByText(/Asignado a las 10:24/)).toBeDefined();

      const callButton = screen.getByRole('button', { name: /Llamar turno/i });
      expect(callButton).toBeDefined();
    });

    it('debe transicionar a CALLED al presionar "Llamar turno", mostrando "Iniciar atención", "Repetir llamado" y "Paciente no presentado"', () => {
      renderWithTheme(<CashierPage />);

      const callButton = screen.getByRole('button', { name: /Llamar turno/i });
      fireEvent.click(callButton);

      expect(screen.getByRole('button', { name: /Iniciar atención/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Repetir llamado/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Paciente no presentado/i })).toBeDefined();
    });

    it('debe transicionar a IN_SERVICE al presionar "Iniciar atención" con acción "Cerrar turno"', () => {
      renderWithTheme(<CashierPage />);

      // Llamar turno -> Iniciar atención
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));
      fireEvent.click(screen.getByRole('button', { name: /Iniciar atención/i }));

      expect(screen.getByText('En atención')).toBeDefined();
      expect(screen.getByRole('button', { name: /Cerrar turno/i })).toBeDefined();
    });

    it('debe quedar en AVAILABLE tras cerrar turno o marcar no presentado, sin acción principal', () => {
      renderWithTheme(<CashierPage />);

      // Llamar y marcar como no presentado
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));
      fireEvent.click(screen.getByRole('button', { name: /Paciente no presentado/i }));

      expect(screen.getByText('Disponible')).toBeDefined();
      expect(screen.getByText(/Esperando asignación automática de paciente/i)).toBeDefined();
      expect(screen.queryByRole('button', { name: /Llamar turno/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Iniciar atención/i })).toBeNull();
    });

    it('debe bloquear el cierre de sesión si hay atención activa', () => {
      renderWithTheme(<CashierPage />);

      // Poner en atención
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));
      fireEvent.click(screen.getByRole('button', { name: /Iniciar atención/i }));

      // Intentar cerrar sesión
      const logoutBtn = screen.getByRole('button', { name: /Cerrar sesión/i });
      fireEvent.click(logoutBtn);

      expect(screen.getByText(/Cierre de sesión bloqueado/i)).toBeDefined();
    });

    it('no debe incluir controles obsoletos (Completar Entrega, Re-Llamar 1/3, cola editable)', () => {
      const { container } = renderWithTheme(<CashierPage />);
      const html = container.innerHTML;

      expect(html).not.toContain('Completar Entrega');
      expect(html).not.toContain('1/3');
      expect(html).not.toContain('FarmaTurnos');
    });
  });

  describe('SCR-PUB-001: Pantalla Pública', () => {
    it('debe mostrar branding "Cubiora Turnos", turno llamado y cubículo con formato TUR-', () => {
      renderWithTheme(<DisplayPage />);

      expect(screen.getByText('Cubiora')).toBeDefined();
      expect(screen.getByText('Turnos')).toBeDefined();
      expect(screen.getByText('Turno llamado')).toBeDefined();
      expect(screen.getByText('Diríjase al')).toBeDefined();
      expect(screen.getByText('TUR-000123-A7')).toBeDefined();
      expect(screen.getByText('Cubículo 03')).toBeDefined();
    });

    it('debe listar entre 3 y 5 llamados recientes con número y cubículo separados visualmente', () => {
      renderWithTheme(<DisplayPage />);

      expect(screen.getByText('Llamados recientes')).toBeDefined();
      expect(screen.getByText('TUR-000120-B2')).toBeDefined();
      expect(screen.getByText('Cubículo 02')).toBeDefined();
      expect(screen.getByText('TUR-000118-C1')).toBeDefined();
      expect(screen.getByText('Cubículo 01')).toBeDefined();
      expect(screen.getByText('TUR-000115-D4')).toBeDefined();
      expect(screen.getByText('Cubículo 04')).toBeDefined();
    });

    it('debe garantizar privacidad total: cero nombres de pacientes y cero documentos (PII)', () => {
      const { container } = renderWithTheme(<DisplayPage />);
      const fullHtml = container.innerHTML;

      expect(fullHtml).not.toMatch(/patientName/i);
      expect(fullHtml).not.toMatch(/patientDocument/i);
      expect(fullHtml).not.toMatch(/cédula/i);
      expect(fullHtml).not.toMatch(/identificación/i);
      expect(fullHtml).not.toMatch(/documento/i);
      expect(fullHtml).not.toMatch(/Pérez/i);
      expect(fullHtml).not.toMatch(/Gómez/i);
    });

    it('no debe incluir barra de navegación ni texto FarmaTurnos', () => {
      const { container } = renderWithTheme(<DisplayPage />);
      const fullHtml = container.innerHTML;

      expect(fullHtml).not.toContain('FarmaTurnos');
      expect(container.querySelector('nav')).toBeNull();
    });
  });
});
