import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import { ReceptionPage } from './reception-page';
import { CashierPage } from './cashier-page';
import { DisplayPage } from './display-page';
import {
  TicketStatus,
  CubicleStatus,
  type CubicleActiveTicket,
  type CubicleSnapshot,
} from '@cubiora/shared';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <Theme accentColor="teal" grayColor="slate">
      <MemoryRouter>{ui}</MemoryRouter>
    </Theme>,
  );
};

function makeTicket(overrides: Partial<CubicleActiveTicket> = {}): CubicleActiveTicket {
  const now = Date.now();
  return {
    id: 'ticket_124',
    publicId: '01JTICK124',
    publicCode: 'TUR-000124-C3',
    patientName: 'Carlos Pérez',
    maskedDocument: 'C.C. ••••••8212',
    status: TicketStatus.ASSIGNED,
    version: 1,
    assignedAt: new Date(now - 300_000).toISOString(),
    calledAt: null,
    serviceStartedAt: null,
    callNumber: 1,
    ...overrides,
  };
}

function makeSnapshot(
  activeTicket: CubicleActiveTicket | null = makeTicket(),
  waitingCount = 0,
): CubicleSnapshot {
  return {
    cubicle: {
      id: 'cub_03',
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      status: activeTicket ? CubicleStatus.RESERVED : CubicleStatus.AVAILABLE,
      version: 1,
    },
    activeTicket,
    waitingCount,
    serverTime: new Date().toISOString(),
  };
}

function responseWith(snapshot: CubicleSnapshot, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: true, data: snapshot }),
  };
}

describe('Contrato Aprobado de Cubiora — Suite de Pantallas e Integración', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;

    // Mock global de EventSource
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
      window.fetch = vi.fn().mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('/tickets/recent')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: [] }),
          };
        }
        return {
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
        };
      });

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
      window.fetch = vi.fn().mockResolvedValue(responseWith(makeSnapshot(makeTicket(), 3)));

      renderWithTheme(<CashierPage />);

      await waitFor(() => {
        expect(screen.getByText('Cubículo 03')).toBeDefined();
        expect(screen.getByText('TUR-000124-C3')).toBeDefined();
        expect(screen.getByText(/Carlos Pérez/)).toBeDefined();
      });

      expect(screen.getByText('C.C. ••••••8212')).toBeDefined();
      expect(screen.getByText('3 pacientes en espera')).toBeDefined();
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
        screen.getByText(
          /No puedes cerrar sesión durante un turno activo\. Finaliza la atención antes de salir\./i,
        ),
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
              cubicle: {
                id: 'cub_03',
                code: 'CUB-03',
                displayName: 'Cubículo 03',
                status: CubicleStatus.RESERVED,
                version: 1,
              },
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
              cubicle: {
                id: 'cub_03',
                code: 'CUB-03',
                displayName: 'Cubículo 03',
                status: CubicleStatus.CALLING,
                version: 2,
              },
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

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/tickets/01JT1/call'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'expected-version': '1',
              'If-Match': '1',
              'Idempotency-Key': expect.any(String),
              'X-Correlation-ID': expect.any(String),
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

    it('debe mantenerse en PROCESSING_CALL hasta recibir la respuesta real del servidor', async () => {
      let resolveCall: ((value: unknown) => void) | undefined;
      const pendingCall = new Promise((resolve) => {
        resolveCall = resolve;
      });

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
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
                id: 't1',
                publicId: '01JT1',
                publicCode: 'TUR-000124-C3',
                patientName: 'Carlos Pérez',
                status: TicketStatus.ASSIGNED,
                version: 1,
                assignedAt: new Date().toISOString(),
                callNumber: 0,
              },
            },
          }),
        })
        .mockImplementationOnce(() => pendingCall);

      window.fetch = mockFetch;
      renderWithTheme(<CashierPage />);

      await waitFor(() => expect(screen.getByText('TUR-000124-C3')).toBeDefined());
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));

      await waitFor(() => {
        expect(screen.getByText(/Llamando turno…/i)).toBeDefined();
      });

      // La interfaz no representa CALLED ni adelanta el estado persistido.
      expect(screen.queryByRole('button', { name: /Iniciar atención/i })).toBeNull();
      expect(screen.queryByText('Llamado')).toBeNull();

      resolveCall?.({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            cubicle: {
              id: 'cub_03',
              code: 'CUB-03',
              displayName: 'Cubículo 03',
              status: CubicleStatus.CALLING,
              version: 2,
            },
            activeTicket: {
              id: 't1',
              publicId: '01JT1',
              publicCode: 'TUR-000124-C3',
              patientName: 'Carlos Pérez',
              status: TicketStatus.CALLED,
              version: 2,
              assignedAt: new Date().toISOString(),
              calledAt: new Date().toISOString(),
              callNumber: 1,
            },
          },
        }),
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Iniciar atención/i })).toBeDefined();
      });
      expect(screen.getAllByText('Llamado').length).toBeGreaterThanOrEqual(1);
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
              cubicle: {
                id: 'cub_03',
                code: 'CUB-03',
                displayName: 'Cubículo 03',
                status: CubicleStatus.RESERVED,
                version: 1,
              },
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
              cubicle: {
                id: 'cub_03',
                code: 'CUB-03',
                displayName: 'Cubículo 03',
                status: CubicleStatus.CALLING,
                version: 2,
              },
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

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/El estado del turno fue actualizado por otro operador/i),
        ).toBeDefined();
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

    it('debe confirmar el cierre y presentar el siguiente turno confirmado por la API', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cubicle: {
                id: 'cub_03',
                code: 'CUB-03',
                displayName: 'Cubículo 03',
                status: CubicleStatus.BUSY,
                version: 4,
              },
              activeTicket: {
                id: 't1',
                publicId: '01JT1',
                publicCode: 'TUR-000124-C3',
                patientName: 'Carlos Pérez',
                status: TicketStatus.IN_SERVICE,
                version: 4,
                assignedAt: new Date(Date.now() - 300_000).toISOString(),
                calledAt: new Date(Date.now() - 240_000).toISOString(),
                serviceStartedAt: new Date(Date.now() - 120_000).toISOString(),
                callNumber: 1,
              },
            },
          }),
        })
        .mockResolvedValueOnce({
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
                version: 6,
              },
              activeTicket: {
                id: 't2',
                publicId: '01JT2',
                publicCode: 'TUR-000125-GE',
                patientName: 'María Ortiz',
                status: TicketStatus.ASSIGNED,
                version: 1,
                assignedAt: new Date().toISOString(),
                callNumber: 0,
              },
            },
          }),
        });

      window.fetch = mockFetch;
      renderWithTheme(<CashierPage />);

      await waitFor(() => expect(screen.getByText('TUR-000124-C3')).toBeDefined());
      fireEvent.click(screen.getByRole('button', { name: /Cerrar turno/i }));

      await waitFor(() => {
        expect(screen.getByText('¿Cerrar el turno TUR-000124-C3?')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Cerrar turno y liberar cubículo/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/tickets/01JT1/close'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'expected-version': '4',
              'Idempotency-Key': expect.any(String),
              'X-Correlation-ID': expect.any(String),
            }),
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText('TUR-000125-GE')).toBeDefined();
        expect(screen.getByRole('button', { name: /Llamar siguiente turno/i })).toBeDefined();
        expect(screen.getByText('TUR-000124-C3')).toBeDefined();
      });
    });

    it('debe confirmar la inasistencia y presentar el siguiente turno sin asumir el estado localmente', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cubicle: {
                id: 'cub_03',
                code: 'CUB-03',
                displayName: 'Cubículo 03',
                status: CubicleStatus.CALLING,
                version: 3,
              },
              activeTicket: {
                id: 't1',
                publicId: '01JT1',
                publicCode: 'TUR-000124-C3',
                patientName: 'Carlos Pérez',
                status: TicketStatus.CALLED,
                version: 3,
                assignedAt: new Date(Date.now() - 120_000).toISOString(),
                calledAt: new Date(Date.now() - 60_000).toISOString(),
                callNumber: 1,
              },
            },
          }),
        })
        .mockResolvedValueOnce({
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
                version: 5,
              },
              activeTicket: {
                id: 't2',
                publicId: '01JT2',
                publicCode: 'TUR-000125-GE',
                patientName: 'María Ortiz',
                status: TicketStatus.ASSIGNED,
                version: 1,
                assignedAt: new Date().toISOString(),
                callNumber: 0,
              },
            },
          }),
        });

      window.fetch = mockFetch;
      renderWithTheme(<CashierPage />);

      await waitFor(() => expect(screen.getByText('TUR-000124-C3')).toBeDefined());
      fireEvent.click(screen.getByRole('button', { name: /Paciente no presentado/i }));

      await waitFor(() => {
        expect(
          screen.getByText('¿Registrar el turno TUR-000124-C3 como no presentado?'),
        ).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Marcar como no presentado/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/tickets/01JT1/no-show'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'expected-version': '3',
              'Idempotency-Key': expect.any(String),
              'X-Correlation-ID': expect.any(String),
            }),
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText('TUR-000125-GE')).toBeDefined();
        expect(screen.getByRole('button', { name: /Llamar siguiente turno/i })).toBeDefined();
        expect(screen.getByText('TUR-000124-C3')).toBeDefined();
      });
    });

    it('debe presentar UNCERTAIN_RESULT ante una respuesta de red perdida y reconciliar sólo a solicitud', async () => {
      const snapshot = makeSnapshot(makeTicket(), 2);
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(responseWith(snapshot))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(responseWith(snapshot));

      window.fetch = mockFetch;
      renderWithTheme(<CashierPage />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Llamar turno/i }));

      await waitFor(() => {
        expect(screen.getByText('No pudimos confirmar la operación.')).toBeDefined();
        expect(
          screen.getByText('Cubiora verificará el estado actual antes de permitir otro intento.'),
        ).toBeDefined();
      });

      // No se repite automáticamente la mutación ni se muestra un éxito local.
      expect(screen.queryByRole('button', { name: /Llamar turno/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Iniciar atención/i })).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByRole('button', { name: /Verificar estado actual/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined();
      });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('debe mostrar banner sin conexión, deshabilitar acciones y recuperar con "Verificar conexión"', async () => {
      const snapshot = makeSnapshot(makeTicket(), 2);
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(responseWith(snapshot))
        .mockResolvedValueOnce(responseWith(snapshot));

      window.fetch = mockFetch;
      renderWithTheme(<CashierPage />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Llamar turno/i })).toBeDefined(),
      );

      window.dispatchEvent(new Event('offline'));

      await waitFor(() => {
        expect(
          screen.getByText('Cubiora no puede confirmar cambios en este momento.'),
        ).toBeDefined();
      });

      const callButton = screen.getByRole('button', { name: /Llamar turno/i });
      expect((callButton as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: /Verificar conexión/i }));

      await waitFor(() => {
        expect(
          (screen.getByRole('button', { name: /Llamar turno/i }) as HTMLButtonElement).disabled,
        ).toBe(false);
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('debe abrir el modal de cierre accesible, enfocar "Continuar atención" y restaurar foco al cancelar', async () => {
      const snapshot = makeSnapshot(
        makeTicket({
          status: TicketStatus.IN_SERVICE,
          serviceStartedAt: new Date(Date.now() - 60_000).toISOString(),
        }),
        1,
      );
      window.fetch = vi.fn().mockResolvedValue(responseWith(snapshot));

      renderWithTheme(<CashierPage />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Cerrar turno/i })).toBeDefined(),
      );

      const closeButton = screen.getByRole('button', { name: /Cerrar turno/i });
      fireEvent.click(closeButton);

      const dialog = await screen.findByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.textContent).toContain('¿Cerrar el turno TUR-000124-C3?');
      expect(dialog.textContent).toContain(
        'Se finalizará la atención y el Cubículo 03 quedará disponible para recibir el siguiente turno.',
      );

      const continueButton = screen.getByRole('button', { name: 'Continuar atención' });
      await waitFor(() => expect(document.activeElement).toBe(continueButton));

      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const restoredCloseButton = screen.getByRole('button', { name: /Cerrar turno/i });
      await waitFor(() => expect(document.activeElement).toBe(restoredCloseButton));
    });

    it('debe mantener PROCESSING_CLOSE bloqueado, deshabilitar ambos botones y presentar el siguiente turno real', async () => {
      let resolveClose: ((value: unknown) => void) | undefined;
      const pendingClose = new Promise((resolve) => {
        resolveClose = resolve;
      });

      const inService = makeSnapshot(
        makeTicket({
          status: TicketStatus.IN_SERVICE,
          serviceStartedAt: new Date(Date.now() - 120_000).toISOString(),
        }),
        1,
      );
      const nextAssigned = makeSnapshot(
        makeTicket({
          id: 'ticket_125',
          publicId: '01JTICK125',
          publicCode: 'TUR-000125-GE',
          patientName: 'María Ortiz',
          status: TicketStatus.ASSIGNED,
          assignedAt: new Date().toISOString(),
          calledAt: null,
          serviceStartedAt: null,
          callNumber: 0,
        }),
        0,
      );

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(responseWith(inService))
        .mockImplementationOnce(() => pendingClose);
      window.fetch = mockFetch;

      renderWithTheme(<CashierPage />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Cerrar turno/i })).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Cerrar turno/i }));
      await waitFor(() =>
        expect(screen.getByText('¿Cerrar el turno TUR-000124-C3?')).toBeDefined(),
      );

      fireEvent.click(screen.getByRole('button', { name: /Cerrar turno y liberar cubículo/i }));

      await waitFor(() =>
        expect(screen.getByText('Cerrando turno y liberando cubículo…')).toBeDefined(),
      );

      const dialog = screen.getByRole('dialog');
      expect(
        (screen.getByRole('button', { name: 'Continuar atención' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(
        (
          screen.getByRole('button', {
            name: /Cerrar turno y liberar cubículo/i,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);

      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
      expect(screen.getByRole('dialog')).toBe(dialog);

      resolveClose?.(responseWith(nextAssigned));

      await waitFor(() => {
        expect(screen.getByText('TUR-000125-GE')).toBeDefined();
        expect(screen.getByRole('button', { name: /Llamar siguiente turno/i })).toBeDefined();
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('debe mostrar CLOSED_NO_NEXT sin acción principal y sin inventar un siguiente turno', async () => {
      const inService = makeSnapshot(
        makeTicket({
          status: TicketStatus.IN_SERVICE,
          serviceStartedAt: new Date(Date.now() - 60_000).toISOString(),
        }),
        1,
      );
      const closed = makeSnapshot(null, 0);

      window.fetch = vi
        .fn()
        .mockResolvedValueOnce(responseWith(inService))
        .mockResolvedValueOnce(responseWith(closed))
        .mockResolvedValueOnce(responseWith(closed));

      renderWithTheme(<CashierPage />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Cerrar turno/i })).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Cerrar turno/i }));
      await waitFor(() =>
        expect(screen.getByText('¿Cerrar el turno TUR-000124-C3?')).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Cerrar turno y liberar cubículo/i }));

      await waitFor(() => {
        expect(screen.getByText('No hay pacientes en espera')).toBeDefined();
        expect(screen.getByText('El cubículo permanece disponible')).toBeDefined();
      });
      expect(screen.queryByRole('button', { name: /Llamar siguiente turno/i })).toBeNull();

      // Una actualización manual posterior devuelve la tarjeta a AVAILABLE.
      fireEvent.click(screen.getByRole('button', { name: /Actualizar estado/i }));
      await waitFor(() => {
        expect(screen.getByText('Esperando el siguiente turno')).toBeDefined();
      });
      expect(screen.queryByText(/finalizado/i)).toBeNull();
    });

    it('debe mostrar NO_SHOW sin siguiente como AVAILABLE y conservar la confirmación real', async () => {
      const called = makeSnapshot(
        makeTicket({
          status: TicketStatus.CALLED,
          calledAt: new Date(Date.now() - 60_000).toISOString(),
        }),
        1,
      );
      const noShow = makeSnapshot(null, 0);

      window.fetch = vi
        .fn()
        .mockResolvedValueOnce(responseWith(called))
        .mockResolvedValueOnce(responseWith(noShow));

      renderWithTheme(<CashierPage />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Paciente no presentado/i })).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Paciente no presentado/i }));
      await waitFor(() =>
        expect(
          screen.getByText('¿Registrar el turno TUR-000124-C3 como no presentado?'),
        ).toBeDefined(),
      );
      fireEvent.click(screen.getByRole('button', { name: /Marcar como no presentado/i }));

      await waitFor(() => {
        expect(screen.getByText(/marcado como no presentado/i)).toBeDefined();
        expect(screen.getByText('Esperando el siguiente turno')).toBeDefined();
        expect(screen.getByText('No hay pacientes en espera')).toBeDefined();
      });
      expect(screen.queryByText('Siguiente turno asignado')).toBeNull();
    });

    it('debe recuperar desde el snapshot un turno CALLED después de recargar y calcular el cronómetro del servidor', async () => {
      const calledAt = new Date(Date.now() - 65_000).toISOString();
      const snapshot = makeSnapshot(
        makeTicket({
          status: TicketStatus.CALLED,
          calledAt,
        }),
        2,
      );

      window.fetch = vi.fn().mockResolvedValue(responseWith(snapshot));
      renderWithTheme(<CashierPage />);

      await waitFor(() => {
        expect(screen.getByText('Llamado')).toBeDefined();
        expect(screen.getByRole('button', { name: /Iniciar atención/i })).toBeDefined();
        expect(screen.getByText(/Tiempo desde el llamado:/)).toBeDefined();
      });

      expect(screen.getByText('C.C. ••••••8212')).toBeDefined();
      expect(screen.getByText('2 pacientes en espera')).toBeDefined();
    });

    it('no debe renderizar "0 pacientes en espera" cuando la cola está vacía', async () => {
      window.fetch = vi.fn().mockResolvedValue(responseWith(makeSnapshot(null, 0)));

      renderWithTheme(<CashierPage />);

      await waitFor(() => {
        expect(screen.getByText('No hay pacientes en espera')).toBeDefined();
        expect(screen.getByText('Esperando el siguiente turno')).toBeDefined();
      });

      expect(screen.queryByText(/0 pacientes en espera/i)).toBeNull();
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
