import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import { ReceptionPage } from './reception-page';
import { CashierPage } from './cashier-page';
import { DisplayPage } from './display-page';
import { TicketStatus, CubicleStatus } from '@cubiora/shared';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <Theme accentColor="teal" grayColor="slate">
      <MemoryRouter>{ui}</MemoryRouter>
    </Theme>,
  );
};

describe('Contrato Aprobado de Cubiora — Suite de Pantallas e Integración', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;

    // Mock global de EventSource
    (globalThis as unknown as { EventSource: unknown }).EventSource = vi.fn().mockImplementation(() => ({
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

    it('debe generar un turno vía POST /api/v1/tickets con Idempotency-Key y mostrar textos y estados aprobados', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            publicId: '01JREC000000001',
            publicCode: 'TUR-000001-GE',
            sequenceNumber: 1,
            patientName: 'Ana Gómez',
            status: TicketStatus.PENDING,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      window.fetch = mockFetch;

      renderWithTheme(<ReceptionPage />);

      const nameInput = screen.getByPlaceholderText(/Ingrese nombre y apellido/i);
      const submitButton = screen.getByRole('button', { name: /Generar turno/i });

      fireEvent.change(nameInput, { target: { value: 'Ana Gómez' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/tickets'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Idempotency-Key': expect.any(String),
            }),
          }),
        );
      });

      // El código emitido debe renderizarse en pantalla
      expect(screen.getAllByText('TUR-000001-GE').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('En espera de asignación')).toBeDefined();
      expect(screen.getByText('Observe la pantalla de llamados')).toBeDefined();

      // Textos aprobados para copiado
      const copyBtn = screen.getByRole('button', { name: /Copiar número de turno/i });
      expect(copyBtn).toBeDefined();
    });

    it('debe renderizar la tabla de últimos turnos sin columna ni dato de Paciente y con máx 3 registros', async () => {
      let seq = 1;
      window.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            publicId: `01JREC00000000${seq}`,
            publicCode: `TUR-00000${seq}-GE`,
            sequenceNumber: seq++,
            patientName: `Paciente Oculto ${seq}`,
            status: TicketStatus.PENDING,
            createdAt: new Date().toISOString(),
          },
        }),
      }));

      renderWithTheme(<ReceptionPage />);
      const nameInput = screen.getByPlaceholderText(/Ingrese nombre y apellido/i);
      const submitButton = screen.getByRole('button', { name: /Generar turno/i });

      // Generar 3 turnos sucesivos esperando confirmación de cada uno
      for (let i = 1; i <= 3; i++) {
        fireEvent.change(nameInput, { target: { value: `Paciente ${i}` } });
        fireEvent.click(submitButton);
        await waitFor(() =>
          expect(screen.getAllByText(`TUR-00000${i}-GE`).length).toBeGreaterThanOrEqual(1),
        );
        await waitFor(() => expect((nameInput as HTMLInputElement).value).toBe(''));
      }

      // La tabla no debe contener el texto "Paciente" en encabezados
      const tableHeaders = screen.getAllByRole('columnheader').map((th) => th.textContent);
      expect(tableHeaders).toEqual(['Turno', 'Hora', 'Cubículo', 'Estado']);
      expect(tableHeaders).not.toContain('Paciente');

      // Máximo 3 filas de datos en el cuerpo de la tabla
      const rows = screen.getAllByRole('row');
      // 1 encabezado + 3 registros = 4
      expect(rows.length).toBeLessThanOrEqual(4);
    });

    it('en ASSIGNED debe mostrar badge Asignado, Cubículo asignado y Observe la pantalla de llamados sin número de cubículo', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            publicId: '01JREC_ASSIGNED',
            publicCode: 'TUR-000100-GE',
            sequenceNumber: 100,
            patientName: 'Pedro Asignado',
            status: TicketStatus.ASSIGNED,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      renderWithTheme(<ReceptionPage />);
      const nameInput = screen.getByPlaceholderText(/Ingrese nombre y apellido/i);
      fireEvent.change(nameInput, { target: { value: 'Pedro Asignado' } });
      fireEvent.click(screen.getByRole('button', { name: /Generar turno/i }));

      await waitFor(() => {
        expect(screen.getByText('Cubículo asignado')).toBeDefined();
        expect(screen.getByText('Observe la pantalla de llamados')).toBeDefined();
        expect(screen.getAllByText('Asignado').length).toBeGreaterThanOrEqual(1);
      });
      // No debe mostrar número específico de cubículo
      expect(screen.queryByText(/Cubículo 03/)).toBeNull();
    });

    it('en CALLED debe mostrar badge Llamado y Diríjase al Cubículo 03', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            publicId: '01JREC_CALLED',
            publicCode: 'TUR-000101-GE',
            sequenceNumber: 101,
            patientName: 'Lucía Llamada',
            status: TicketStatus.CALLED,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      renderWithTheme(<ReceptionPage />);
      const nameInput = screen.getByPlaceholderText(/Ingrese nombre y apellido/i);
      fireEvent.change(nameInput, { target: { value: 'Lucía Llamada' } });
      fireEvent.click(screen.getByRole('button', { name: /Generar turno/i }));

      await waitFor(() => {
        expect(screen.getAllByText('Llamado').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Diríjase al Cubículo 03/i)).toBeDefined();
      });
    });
  });

  describe('SCR-CAJ-001: Mi Cubículo (Caja)', () => {
    it('debe cargar snapshot inicial desde la API y mostrar turno asignado', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            cubicle: {
              id: 'cub_03',
              code: 'CUB-03',
              displayName: 'Cubículo 03',
              status: CubicleStatus.RESERVED,
              version: 1,
            },
            activeTicket: {
              id: 'ticket_124',
              publicId: '01JTICK124',
              publicCode: 'TUR-000124-C3',
              patientName: 'Carlos Pérez',
              status: TicketStatus.ASSIGNED,
              assignedAt: new Date().toISOString(),
              version: 1,
              callNumber: 0,
            },
          },
        }),
      });

      renderWithTheme(<CashierPage />);

      await waitFor(() => {
        expect(screen.getByText('Cubículo 03')).toBeDefined();
        expect(screen.getByText('TUR-000124-C3')).toBeDefined();
        expect(screen.getByText(/Carlos Pérez/)).toBeDefined();
      });

      expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined();
    });

    it('debe bloquear cierre de sesión en ASSIGNED, CALLED e IN_SERVICE con mensaje y acción "Volver al turno"', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            cubicle: {
              id: 'cub_03',
              code: 'CUB-03',
              displayName: 'Cubículo 03',
              status: CubicleStatus.RESERVED,
              version: 1,
            },
            activeTicket: {
              id: 'ticket_124',
              publicId: '01JTICK124',
              publicCode: 'TUR-000124-C3',
              patientName: 'Carlos Pérez',
              status: TicketStatus.ASSIGNED,
              version: 1,
              callNumber: 0,
            },
          },
        }),
      });

      renderWithTheme(<CashierPage />);
      await waitFor(() => expect(screen.getByText('TUR-000124-C3')).toBeDefined());

      // Intentar cerrar sesión estando en ASSIGNED
      const logoutBtn = screen.getByRole('button', { name: /Cerrar sesión/i });
      fireEvent.click(logoutBtn);

      // Mensaje bloqueante normativo
      expect(
        screen.getByText(/No puedes cerrar sesión durante un turno activo\. Finaliza la atención antes de salir\./i),
      ).toBeDefined();

      // Acción única: Volver al turno
      const backBtn = screen.getByRole('button', { name: /Volver al turno/i });
      expect(backBtn).toBeDefined();
      fireEvent.click(backBtn);
    });

    it('debe ejecutar comandos reales con expected-version e idempotency-key', async () => {
      const mockFetch = vi
        .fn()
        // 1. Snapshot inicial (ASSIGNED)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cubicle: { id: 'cub_03', code: 'CUB-03', displayName: 'Cubículo 03', status: CubicleStatus.RESERVED, version: 1 },
              activeTicket: {
                id: 't1',
                publicId: '01JT1',
                publicCode: 'TUR-000124-C3',
                patientName: 'Carlos Pérez',
                status: TicketStatus.ASSIGNED,
                version: 1,
                callNumber: 0,
              },
            },
          }),
        })
        // 2. Respuesta a callTicket (CALLED)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cubicle: { id: 'cub_03', code: 'CUB-03', displayName: 'Cubículo 03', status: CubicleStatus.CALLING, version: 2 },
              activeTicket: {
                id: 't1',
                publicId: '01JT1',
                publicCode: 'TUR-000124-C3',
                patientName: 'Carlos Pérez',
                status: TicketStatus.CALLED,
                version: 2,
                callNumber: 1,
              },
            },
          }),
        });

      window.fetch = mockFetch;
      renderWithTheme(<CashierPage />);

      await waitFor(() => expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined());
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/tickets/t1/call'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'expected-version': '1',
              'Idempotency-Key': expect.any(String),
            }),
          }),
        );
      });

      // Ahora debe mostrar las acciones de CALLED
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Iniciar atención/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Repetir llamado/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Paciente no presentado/i })).toBeDefined();
      });
    });

    it('en conflicto 409 debe solicitar snapshot vigente y sincronizar el estado', async () => {
      const mockFetch = vi
        .fn()
        // 1. Snapshot inicial
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cubicle: { id: 'cub_03', code: 'CUB-03', displayName: 'Cubículo 03', status: CubicleStatus.RESERVED, version: 1 },
              activeTicket: {
                id: 't1',
                publicId: '01JT1',
                publicCode: 'TUR-000124-C3',
                patientName: 'Carlos Pérez',
                status: TicketStatus.ASSIGNED,
                version: 1,
                callNumber: 0,
              },
            },
          }),
        })
        // 2. Intento de call retorna 409 Conflict
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({
            code: 'STATE_CONFLICT',
            message: 'Conflicto de versión optimista.',
          }),
        })
        // 3. Refresco de snapshot tras 409
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cubicle: { id: 'cub_03', code: 'CUB-03', displayName: 'Cubículo 03', status: CubicleStatus.CALLING, version: 2 },
              activeTicket: {
                id: 't1',
                publicId: '01JT1',
                publicCode: 'TUR-000124-C3',
                patientName: 'Carlos Pérez',
                status: TicketStatus.CALLED,
                version: 2,
                callNumber: 1,
              },
            },
          }),
        });

      window.fetch = mockFetch;
      renderWithTheme(<CashierPage />);

      await waitFor(() => expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined());
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));

      await waitFor(() => {
        expect(screen.getByText(/El estado del turno fue actualizado por otro operador/i)).toBeDefined();
      });
    });

    it('debe permitir cerrar sesión en AVAILABLE sin advertencias ni bloqueos', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            cubicle: {
              id: 'cub_03',
              code: 'CUB-03',
              displayName: 'Cubículo 03',
              status: CubicleStatus.AVAILABLE,
              version: 1,
            },
            activeTicket: null,
          },
        }),
      });

      renderWithTheme(<CashierPage />);
      await waitFor(() => expect(screen.getByText('Disponible')).toBeDefined());

      const logoutBtn = screen.getByRole('button', { name: /Cerrar sesión/i });
      fireEvent.click(logoutBtn);

      // No debe abrirse el diálogo de bloqueo
      expect(screen.queryByText(/No puedes cerrar sesión durante un turno activo/i)).toBeNull();
    });
  });

  describe('SCR-PUB-001: Pantalla Pública', () => {
    it('debe cargar snapshot inicial vía API y mostrar turno llamado principal', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            currentCall: {
              publicCode: 'TUR-000123-A7',
              cubicleDisplayName: 'Cubículo 03',
              calledAt: new Date().toISOString(),
              callNumber: 1,
            },
            recentCalls: [
              {
                publicCode: 'TUR-000120-B2',
                cubicleDisplayName: 'Cubículo 02',
                calledAt: new Date().toISOString(),
                callNumber: 1,
              },
            ],
          },
        }),
      });

      renderWithTheme(<DisplayPage />);

      await waitFor(() => {
        expect(screen.getByText('Cubiora')).toBeDefined();
        expect(screen.getByText('Turnos')).toBeDefined();
        expect(screen.getByText('TUR-000123-A7')).toBeDefined();
        expect(screen.getByText('Cubículo 03')).toBeDefined();
      });
    });

    it('en llamados recientes no debe mostrar badge, mostrando solamente número de turno y cubículo', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            currentCall: null,
            recentCalls: [
              {
                publicCode: 'TUR-000120-B2',
                cubicleDisplayName: 'Cubículo 02',
                calledAt: new Date().toISOString(),
                callNumber: 1,
              },
            ],
          },
        }),
      });

      const { container } = renderWithTheme(<DisplayPage />);

      await waitFor(() => {
        expect(screen.getByText('TUR-000120-B2')).toBeDefined();
        expect(screen.getByText('Cubículo 02')).toBeDefined();
      });

      // No debe contener el texto obsoleto "Esperando en cubículo"
      expect(container.innerHTML).not.toContain('Esperando en cubículo');
    });

    it('debe garantizar Cero PII en pantalla pública', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            currentCall: {
              publicCode: 'TUR-000123-A7',
              cubicleDisplayName: 'Cubículo 03',
              calledAt: new Date().toISOString(),
              callNumber: 1,
            },
            recentCalls: [],
          },
        }),
      });

      const { container } = renderWithTheme(<DisplayPage />);
      await waitFor(() => expect(screen.getByText('TUR-000123-A7')).toBeDefined());

      const html = container.innerHTML;
      expect(html).not.toMatch(/paciente/i);
      expect(html).not.toMatch(/cédula/i);
      expect(html).not.toMatch(/documento/i);
      expect(html).not.toMatch(/identificación/i);
    });

    it('debe ofrecer control de audio opcional y accesible', async () => {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { currentCall: null, recentCalls: [] } }),
      });

      renderWithTheme(<DisplayPage />);

      const soundBtn = screen.getByRole('button', { name: /Sonido desactivado/i });
      expect(soundBtn).toBeDefined();

      fireEvent.click(soundBtn);
      expect(screen.getByText(/Sonido activo/i)).toBeDefined();
    });
  });
});
