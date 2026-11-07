// ─── SCR-ADM-001 · KpiCard ───────────────────────────────────────────────────
import React from 'react';

interface KpiCardProps {
  label: string;
  icon: React.ReactNode;
  mainValue: string;
  mainUnit: string;
  secondaryValue: React.ReactNode;
  secondaryLabel: string;
  footer: React.ReactNode;
}

export const KpiCard: React.FC<KpiCardProps> = React.memo(({
  label,
  icon,
  mainValue,
  mainUnit,
  secondaryValue,
  secondaryLabel,
  footer,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col gap-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          {label}
        </span>
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-50 text-sky-700">
          {icon}
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div className="flex items-end justify-between gap-2">
        {/* Valor principal */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold font-mono tabular-nums text-slate-900 leading-none">
            {mainValue}
          </span>
          <span className="text-xs text-slate-600 font-medium">{mainUnit}</span>
        </div>

        {/* Valor secundario */}
        <div className="text-right">
          <div className="text-sm font-bold">{secondaryValue}</div>
          <div className="text-[11px] text-slate-600 font-medium">{secondaryLabel}</div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-slate-100 pt-2.5">{footer}</div>
    </div>
  );
});

KpiCard.displayName = 'KpiCard';

