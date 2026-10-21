import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Pantallas Web de Cubiora', () => {
  it('debe renderizar la pantalla de Recepción con su formulario de emisión', () => {
    renderWithTheme(<ReceptionPage />);

    expect(screen.getByText('Registro de Turno Presencial')).toBeDefined();
    expect(screen.getByLabelText(/Nombre Completo del Paciente/i)).toBeDefined();
    expect(screen.getByLabelText(/Documento de Identidad/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Generar Turno/i })).toBeDefined();
  });

  it('debe renderizar la pantalla de Cajero / Atención con selección de cubículo', () => {
    renderWithTheme(<CashierPage />);

    expect(screen.getByText('Atención en Cubículo')).toBeDefined();
    expect(screen.getByRole('button', { name: /Llamar Siguiente Turno/i })).toBeDefined();
    expect(screen.getByText(/Cubículo 1/i)).toBeDefined();
  });

  it('debe renderizar la pantalla pública de llamados sin exponer datos personales (PII)', () => {
    const { container } = renderWithTheme(<DisplayPage />);

    // Debe mostrar encabezado y códigos de turnos
    expect(screen.getByText('Pantalla de Llamados')).toBeDefined();
    expect(screen.getByText('Turno en Atención')).toBeDefined();

    // Verificación estricta de privacidad de datos
    const fullHtml = container.innerHTML;

    // Regla de privacidad: NUNCA debe incluir etiquetas o campos de pacientes
    expect(fullHtml).not.toMatch(/patientName/i);
    expect(fullHtml).not.toMatch(/patientDocument/i);
    expect(fullHtml).not.toMatch(/cédula/i);
    expect(fullHtml).not.toMatch(/identificación/i);
    expect(fullHtml).not.toMatch(/documento/i);
  });
});
