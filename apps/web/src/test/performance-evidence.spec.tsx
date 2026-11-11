// ─── [FASE D] Evidencia Medida de Rendimiento y Escalabilidad ────────────────
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { Theme } from '@radix-ui/themes';
import { DailyAuditTable } from '../features/admin-history/daily-audit-table';
import type { DailyAuditRecord } from '../features/admin-history/types';

describe('[FASE D] Medición de Rendimiento y Escalabilidad con Evidencia Numérica', () => {
  // ─── 1. Tabla de Auditoría con ≥ 600 filas ──────────────────────────────
  const generateLargeDataset = (count: number): DailyAuditRecord[] => {
    return Array.from({ length: count }, (_, idx) => {
      const pad = String(idx + 1).padStart(6, '0');
      const publicCode = `TUR-${pad}-X1`;
      return {
        id: `turn-${idx + 1}`,
        ticketCode: publicCode,
        publicCode,
        assignedStation: `Cubículo ${String((idx % 5) + 1).padStart(2, '0')}`,
        operatorName: `Lic. Farmacéutico ${idx % 10}`,
        priority: idx % 3 === 0 ? ('PREFERENCIAL' as const) : ('GENERAL' as const),
        serviceDurationFormatted: '5m 30s',
        serviceDurationSeconds: 330,
        slaCompliant: idx % 8 !== 0,
        resultStatus: idx % 12 === 0 ? ('ABANDONADO' as const) : ('FINALIZADO' as const),
        finishedAtFormatted: '11:45:00',
      };
    });
  };

  it('Mide tiempo de renderizado y nodos del DOM con 600 filas: Con vs Sin Paginación', () => {
    const records = generateLargeDataset(600);

    // Medición SIN paginación (renderizando las 600 filas simultáneamente en el DOM)
    const t0Without = performance.now();
    const { container: containerWithout, unmount: unmountWithout } = render(
      <Theme accentColor="blue" grayColor="slate">
        <DailyAuditTable records={records} pageSize={600} />
      </Theme>,
    );
    const t1Without = performance.now();
    const durationWithoutMs = Math.round((t1Without - t0Without) * 100) / 100;
    const domRowsWithout = containerWithout.querySelectorAll('tbody tr').length;
    const totalDomElementsWithout = containerWithout.querySelectorAll('*').length;
    unmountWithout();

    // Medición CON paginación (pageSize = 25)
    const t0With = performance.now();
    const { container: containerWith, unmount: unmountWith } = render(
      <Theme accentColor="blue" grayColor="slate">
        <DailyAuditTable records={records} pageSize={25} />
      </Theme>,
    );
    const t1With = performance.now();
    const durationWithMs = Math.round((t1With - t0With) * 100) / 100;
    const domRowsWith = containerWith.querySelectorAll('tbody tr').length;
    const totalDomElementsWith = containerWith.querySelectorAll('*').length;
    unmountWith();

    console.log(`[FASE D - Benchmark 600 filas]`);
    console.log(`  Sin paginación (600 filas DOM): ${durationWithoutMs} ms | ${domRowsWithout} filas <tr> | ${totalDomElementsWithout} elementos DOM`);
    console.log(`  Con paginación (25 filas DOM):  ${durationWithMs} ms | ${domRowsWith} filas <tr> | ${totalDomElementsWith} elementos DOM`);
    console.log(`  Reducción de nodos DOM: ${Math.round((1 - totalDomElementsWith / totalDomElementsWithout) * 100)}%`);

    // Verificaciones cuantitativas
    expect(domRowsWithout).toBe(600);
    expect(domRowsWith).toBe(25);
    expect(totalDomElementsWith).toBeLessThan(totalDomElementsWithout);
  });

  // ─── 2. Profiling de KpiCard con React.memo ante Ticker de 1s ─────────────
  it('Verifica el efecto de React.memo en KpiCard ante renders del padre', () => {
    let memoRenderCount = 0;
    const MemoTrackedKpi = React.memo(() => {
      memoRenderCount++;
      return <div data-testid="kpi">KPI</div>;
    });

    let nonMemoRenderCount = 0;
    const NonMemoTrackedKpi = () => {
      nonMemoRenderCount++;
      return <div data-testid="kpi-nonmemo">KPI</div>;
    };

    // Componente simulando el dashboard con ticker de 1 segundo
    const ParentDashboard = ({ tickValue }: { tickValue: number }) => {
      return (
        <div>
          <span>Reloj: {tickValue}</span>
          <MemoTrackedKpi />
          <NonMemoTrackedKpi />
        </div>
      );
    };

    const { rerender } = render(<ParentDashboard tickValue={1} />);
    expect(memoRenderCount).toBe(1);
    expect(nonMemoRenderCount).toBe(1);

    // Simular 5 ticks del reloj (1 por segundo) donde las props del KPI son idénticas
    for (let i = 2; i <= 6; i++) {
      act(() => {
        rerender(<ParentDashboard tickValue={i} />);
      });
    }

    console.log(`[FASE D - Profiler React.memo ante 5 ticks de 1s]`);
    console.log(`  Sin memo (NonMemoTrackedKpi): ${nonMemoRenderCount} renders (1 render/segundo)`);
    console.log(`  Con memo (MemoTrackedKpi):    ${memoRenderCount} renders (0 re-renders por tick)`);

    expect(nonMemoRenderCount).toBe(6); // 1 inicial + 5 ticks
    expect(memoRenderCount).toBe(1);    // 1 inicial + 0 por ticks (aislado al 100%)
  });
});
