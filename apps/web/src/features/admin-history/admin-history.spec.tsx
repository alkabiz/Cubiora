// ─── [SCR-ADM-003] Tests Unitarios de Historial · Registro Operativo Diario ────
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import { AdminHistoryScreen } from './admin-history-screen';
import { DailyAuditTable } from './daily-audit-table';

const renderComponent = () => {
  return render(
    <Theme accentColor="teal" grayColor="slate">
      <MemoryRouter>
        <AdminHistoryScreen />
      </MemoryRouter>
    </Theme>,
  );
};

describe('[SCR-ADM-003] Historial · Registro Operativo Diario', () => {
  it('1. Renderiza el Header superior con breadcrumbs, título principal, Exportar CSV y enlace de regreso', () => {
    renderComponent();

    // Breadcrumb
    expect(screen.getByText('SCR-ADM-003')).toBeDefined();
    expect(screen.getByText('Auditoría Operativa de Tiempos y Despacho')).toBeDefined();

    // Título Principal
    expect(
      screen.getByText('[SCR-ADM-003] Historial · Registro Operativo Diario'),
    ).toBeDefined();

    // Botones de acción
    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeDefined();
    expect(screen.getByText('← Volver al Panel General')).toBeDefined();
  });

  it('2. Renderiza las 4 filas iniciales de turnos con sus puestos, operadores, tiempos y badges de resultado', () => {
    renderComponent();

    // 1. Códigos de turno
    expect(screen.getByText('TUR-000119-L2')).toBeDefined();
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
    expect(screen.getByText('TUR-000117-K9')).toBeDefined();
    expect(screen.getByText('TUR-000116-X3')).toBeDefined();

    // 2. Puestos asignados
    expect(screen.getByText('Cubículo 04')).toBeDefined();
    expect(screen.getByText('Cubículo 03')).toBeDefined();
    expect(screen.getByText('Cubículo 01')).toBeDefined();
    expect(screen.getByText('Cubículo 02')).toBeDefined();

    // 3. Operadores
    expect(screen.getByText('Farm. S. Quintero')).toBeDefined();
    expect(screen.getByText('Lic. R. Mendoza')).toBeDefined();
    expect(screen.getByText('Lic. M. Arismendi')).toBeDefined();
    expect(screen.getByText('Farm. J. Duarte')).toBeDefined();

    // 4. Prioridades
    expect(screen.getAllByText('GENERAL').length).toBe(3);
    expect(screen.getByText('PREFERENCIAL')).toBeDefined();

    // 5. Tiempos de atención
    expect(screen.getByText('6m 52s')).toBeDefined();
    expect(screen.getAllByText('7m 0s').length).toBe(2);
    expect(screen.getByText('2m 0s')).toBeDefined();

    // 6. Cumplimiento SLA
    expect(screen.getAllByText('Cumplido').length).toBe(4);

    // 7. Badges de resultado
    expect(screen.getAllByText('FINALIZADO').length).toBe(3);
    expect(screen.getByText('ABANDONADO')).toBeDefined();
  });

  it('3. Filtra registros en tiempo real mediante el input de búsqueda', () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText('Buscar por código de turno o puesto...');

    // Filtrar por código
    fireEvent.change(searchInput, { target: { value: 'TUR-000118' } });
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
    expect(screen.queryByText('TUR-000119-L2')).toBeNull();
    expect(screen.queryByText('TUR-000117-K9')).toBeNull();

    // Filtrar por puesto
    fireEvent.change(searchInput, { target: { value: 'Cubículo 01' } });
    expect(screen.getByText('TUR-000117-K9')).toBeDefined();
    expect(screen.queryByText('TUR-000118-H1')).toBeNull();

    // Filtrar por operador
    fireEvent.change(searchInput, { target: { value: 'Duarte' } });
    expect(screen.getByText('TUR-000116-X3')).toBeDefined();
    expect(screen.queryByText('TUR-000117-K9')).toBeNull();

    // Limpiar búsqueda
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('TUR-000119-L2')).toBeDefined();
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
  });

  it('4. Conmuta entre los filtros de SLA (Todos, En Norma, Excedidos) y muestra estado vacío si no hay coincidencias', () => {
    renderComponent();

    const allBtn = screen.getByRole('button', { name: 'Todos' });
    const inNormBtn = screen.getByRole('button', { name: /En Norma/i });
    const exceededBtn = screen.getByRole('button', { name: 'Excedidos' });

    // En Norma (<8m)
    fireEvent.click(inNormBtn);
    expect(screen.getByText('TUR-000119-L2')).toBeDefined();
    expect(screen.getByText('TUR-000118-H1')).toBeDefined();
    expect(screen.getByText('TUR-000117-K9')).toBeDefined();
    expect(screen.getByText('TUR-000116-X3')).toBeDefined();

    // Excedidos (ninguno en la semilla supera los 8 minutos)
    fireEvent.click(exceededBtn);
    expect(
      screen.getByText('No se encontraron registros que coincidan con los criterios de filtro.'),
    ).toBeDefined();
    expect(screen.queryByText('TUR-000119-L2')).toBeNull();

    // Volver a Todos
    fireEvent.click(allBtn);
    expect(screen.getByText('TUR-000119-L2')).toBeDefined();
    expect(screen.getByText('TUR-000116-X3')).toBeDefined();
  });

  it('5. Genera la exportación CSV al pulsar el botón "Exportar CSV"', () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    renderComponent();

    const exportBtn = screen.getByRole('button', { name: /Exportar CSV/i });
    fireEvent.click(exportBtn);

    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('6. Pagina correctamente cuando el volumen de turnos excede la página (escalabilidad >= 25 turnos)', () => {
    const manyRecords = Array.from({ length: 60 }, (_, i) => ({
      id: `rec_${i + 1}`,
      ticketCode: `TUR-000${String(i + 1).padStart(3, '0')}-A1`,
      assignedStation: 'Cubículo 01',
      operatorName: 'Lic. M. Arismendi',
      priority: 'GENERAL' as const,
      serviceDurationFormatted: '5m 0s',
      serviceDurationSeconds: 300,
      slaCompliant: true,
      resultStatus: 'FINALIZADO' as const,
      finishedAtFormatted: '10:00:00',
    }));

    render(
      <Theme accentColor="teal" grayColor="slate">
        <DailyAuditTable records={manyRecords} pageSize={25} />
      </Theme>,
    );

    // Debe mostrar la primera página con 25 registros
    expect(screen.getByText('TUR-000001-A1')).toBeDefined();
    expect(screen.getByText('TUR-000025-A1')).toBeDefined();
    expect(screen.queryByText('TUR-000026-A1')).toBeNull();

    // Controles de paginación
    expect(
      screen.getByText((_content, element) => {
        return element?.tagName.toLowerCase() === 'div' && element.textContent?.trim() === 'Mostrando 1 a 25 de 60 registros';
      }),
    ).toBeDefined();
    expect(screen.getByText('Página 1 de 3')).toBeDefined();

    // Avanzar a la página 2
    const nextBtn = screen.getByRole('button', { name: 'Siguiente' });
    fireEvent.click(nextBtn);

    expect(screen.queryByText('TUR-000001-A1')).toBeNull();
    expect(screen.getByText('TUR-000026-A1')).toBeDefined();
    expect(screen.getByText('Página 2 de 3')).toBeDefined();
  });
});
