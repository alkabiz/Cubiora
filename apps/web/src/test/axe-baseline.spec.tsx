/* eslint-disable no-console */
/**
 * [FASE A — Semántica ARIA] aria-semantics.spec.tsx
 *
 * ALCANCE Y LIMITACIONES DOCUMENTADAS:
 * Este test usa axe-core en JSDOM (entorno de Node.js sin layout real).
 *
 * LO QUE JSDOM SÍ PUEDE VERIFICAR (y se verifica aquí):
 * - Estructura semántica: roles ARIA, landmarks, etiquetas de inputs, alt de imágenes.
 * - Atributos ARIA incorrectos (ej. aria-label en elementos no interactivos).
 * - Estructura de headings (jerarquía h1→h2→h3).
 * - Formularios sin labels asociados.
 * - Tablas sin encabezados.
 *
 * LO QUE JSDOM NO PUEDE VERIFICAR (pendiente de Playwright en navegador real):
 * - WCAG 1.4.3 Contraste de texto: JSDOM no calcula estilos computados con Tailwind.
 * - WCAG 1.4.11 Contraste de componentes no textuales (bordes de inputs, focus rings).
 * - WCAG 2.4.7 / 2.4.11 Foco visible: JSDOM no simula interacción de teclado real.
 * - WCAG 1.4.4 / 1.4.10: Zoom y reflow requieren navegador con motor CSS real.
 * - WCAG 2.5.8: Tamaño real en píxeles físicos (getBoundingClientRect devuelve 0 en JSDOM).
 *
 * Las reglas de contraste están desactivadas explícitamente con `disableRules`
 * para evitar falsos negativos.
 *
 * Para verificación de contraste y foco, ver: apps/web/e2e/axe-browser.spec.ts (Fase A completa).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import axe from 'axe-core';

import { LoginPage } from '../pages/login-page';
import { ReceptionPage } from '../pages/reception-page';
import { CashierPage } from '../pages/cashier-page';
import { AdminOverviewScreen } from '../features/admin-overview/admin-overview-screen';
import { AdminCubiclesScreen } from '../features/admin-cubicles/admin-cubicles-screen';
import { AdminHistoryScreen } from '../features/admin-history/admin-history-screen';
import { PublicDisplayScreen } from '../features/public-display/public-display-screen';
import { AuthProvider } from '../context/auth-context';

// Reglas que JSDOM no puede evaluar correctamente (require layout real de navegador)
const JSDOM_UNRELIABLE_RULES = [
  'color-contrast',           // 1.4.3 — requiere estilos computados reales
  'color-contrast-enhanced',  // 1.4.6
  'focus-order-semantics',    // 2.4.3 — requiere navegación real
  'scrollable-region-focusable', // requiere scroll real
  'target-size',              // 2.5.8 — getBoundingClientRect devuelve 0
];

describe('[JSDOM] Semántica ARIA — Verificación de estructura accesible (no contraste)', () => {
  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <Theme accentColor="teal" grayColor="slate">
        <AuthProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </AuthProvider>
      </Theme>,
    );
  };

  const runAxeSemantics = async (container: HTMLElement, label: string) => {
    const results = await axe.run(container, {
      rules: JSDOM_UNRELIABLE_RULES.reduce(
        (acc, ruleId) => {
          acc[ruleId] = { enabled: false };
          return acc;
        },
        {} as Record<string, { enabled: boolean }>,
      ),
    });

    const semanticViolations = results.violations.filter(
      (v) => !JSDOM_UNRELIABLE_RULES.includes(v.id),
    );

    if (semanticViolations.length > 0) {
      console.error(
        `${label} — violaciones semánticas ARIA:`,
        semanticViolations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => n.html).slice(0, 2),
        })),
      );
    }

    return semanticViolations;
  };

  it('LoginPage: sin violaciones semánticas ARIA', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    const violations = await runAxeSemantics(container, 'LoginPage');
    expect(violations, `Violaciones semánticas en LoginPage: ${violations.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });

  it('ReceptionPage: sin violaciones semánticas ARIA', async () => {
    const { container } = renderWithProviders(<ReceptionPage />);
    const violations = await runAxeSemantics(container, 'ReceptionPage');
    expect(violations, `Violaciones semánticas en ReceptionPage: ${violations.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });

  it('CashierPage: sin violaciones semánticas ARIA', async () => {
    const { container } = renderWithProviders(<CashierPage />);
    const violations = await runAxeSemantics(container, 'CashierPage');
    expect(violations, `Violaciones semánticas en CashierPage: ${violations.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });

  it('AdminOverviewScreen: sin violaciones semánticas ARIA', async () => {
    const { container } = renderWithProviders(<AdminOverviewScreen />);
    const violations = await runAxeSemantics(container, 'AdminOverviewScreen');
    expect(violations, `Violaciones semánticas en AdminOverviewScreen: ${violations.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });

  it('AdminCubiclesScreen: sin violaciones semánticas ARIA', async () => {
    const { container } = renderWithProviders(<AdminCubiclesScreen />);
    const violations = await runAxeSemantics(container, 'AdminCubiclesScreen');
    expect(violations, `Violaciones semánticas en AdminCubiclesScreen: ${violations.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });

  it('AdminHistoryScreen: sin violaciones semánticas ARIA', async () => {
    const { container } = renderWithProviders(<AdminHistoryScreen />);
    const violations = await runAxeSemantics(container, 'AdminHistoryScreen');
    expect(violations, `Violaciones semánticas en AdminHistoryScreen: ${violations.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });

  it('PublicDisplayScreen: sin violaciones semánticas ARIA', async () => {
    const { container } = renderWithProviders(<PublicDisplayScreen />);
    const violations = await runAxeSemantics(container, 'PublicDisplayScreen');
    expect(violations, `Violaciones semánticas en PublicDisplayScreen: ${violations.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });
});
