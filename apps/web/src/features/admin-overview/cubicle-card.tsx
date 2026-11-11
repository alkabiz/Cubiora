// ─── SCR-ADM-001 · CubicleCard ───────────────────────────────────────────────
import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Clock,
  Wrench,
} from 'lucide-react';
import type { CubicleStation, CubicleStatus } from './types';
import { formatWaitTime } from './use-operational-telemetry';

// ─── Tokens de estado ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  CubicleStatus,
  {
    border: string;
    badge: string;
    centerBlock: string;
    timeText: string;
    label: string;
  }
> = {
  ATENDIENDO: {
    border: 'border-[#0081cf]/50',
    badge: 'bg-[#0081cf]/12 text-[#0f172a] border border-[#0081cf]',
    centerBlock: 'bg-slate-50/80',
    timeText: 'text-[#0f172a] font-bold font-mono tabular-nums',
    label: 'ATENDIENDO',
  },
  SLA_EXCEDIDO: {
    border: 'border-red-300 ring-1 ring-red-200',
    badge: 'bg-red-100 text-red-700',
    centerBlock: 'bg-red-50/50',
    timeText: 'text-red-700 font-bold font-mono tabular-nums',
    label: 'SLA EXCEDIDO',
  },
  LLAMANDO: {
    border: 'border-[#008e9b]/50',
    badge: 'bg-[#008e9b]/12 text-[#0f172a] border border-[#008e9b]',
    centerBlock: 'bg-[#008e9b]/8',
    timeText: 'text-[#0f172a] font-bold font-mono tabular-nums',
    label: 'LLAMANDO',
  },
  DISPONIBLE: {
    border: 'border-[#008f7a]/50',
    badge: 'bg-[#008f7a]/12 text-[#0f172a] border border-[#008f7a]',
    centerBlock: 'bg-[#008f7a]/8',
    timeText: 'text-[#0f172a] font-bold font-mono tabular-nums',
    label: 'DISPONIBLE',
  },
  INACTIVO: {
    border: 'border-slate-200/90',
    badge: 'bg-slate-100 text-slate-700',
    centerBlock: 'bg-slate-50',
    timeText: 'text-slate-700 font-semibold font-mono tabular-nums',
    label: 'INACTIVO',
  },
};

// ─── Footer icon por estado ───────────────────────────────────────────────────
function StatusFooterIcon({ status }: { status: CubicleStatus }) {
  switch (status) {
    case 'ATENDIENDO':
      return <CheckCircle2 size={12} className="text-[#0081cf] flex-shrink-0" />;
    case 'DISPONIBLE':
      return <CheckCircle2 size={12} className="text-[#008f7a] flex-shrink-0" />;
    case 'SLA_EXCEDIDO':
      return <AlertTriangle size={12} className="text-red-600 flex-shrink-0" />;
    case 'LLAMANDO':
      return <Volume2 size={12} className="text-[#008e9b] flex-shrink-0" />;
    case 'INACTIVO':
      return <Wrench size={12} className="text-slate-600 flex-shrink-0" />;
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface CubicleCardProps {
  station: CubicleStation;
}

export const CubicleCard: React.FC<CubicleCardProps> = React.memo(({ station }) => {
  const cfg = STATUS_CONFIG[station.status];
  const isInactive = station.status === 'INACTIVO';

  return (
    <article
      className={[
        'bg-white rounded-xl border shadow-xs overflow-hidden flex flex-col',
        cfg.border,
        station.fullWidth ? 'md:col-span-2' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Estado badge */}
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wider ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          {/* Nombre cubículo */}
          <span className="text-xs font-semibold text-slate-700 truncate">{station.name}</span>
        </div>
        {/* Módulo badge */}
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 ml-2 flex-shrink-0">
          {station.moduleCode}
        </span>
      </div>

      {/* ── Bloque central ── */}
      <div className={`mx-3.5 mb-3 rounded-lg p-3 ${cfg.centerBlock}`}>
        <div className="flex items-start justify-between gap-3">
          {/* Turno + Operador */}
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-mono font-bold truncate ${
                station.status === 'SLA_EXCEDIDO'
                  ? 'text-red-600'
                  : station.status === 'LLAMANDO'
                    ? 'text-[#0f172a]'
                    : 'text-slate-800'
              }`}
            >
              {station.assignedTicket ?? 'Sin turno asignado'}
            </p>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              {station.operatorName ?? 'Sin operador asignado'}
            </p>
          </div>

          {/* Tiempo / Estado temporal */}
          <div className="flex-shrink-0 flex items-center gap-1.5">
            {!isInactive && <Clock size={13} className="text-slate-600" aria-hidden="true" />}
            <span className={`text-sm ${cfg.timeText}`}>
              {station.elapsedTimeFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-3.5 pb-3 mt-auto border-t border-slate-100 pt-2">
        {/* Footer izquierdo */}
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusFooterIcon status={station.status} />
          <span
            className={`text-xs truncate ${
              isInactive
                ? 'text-slate-600 italic'
                : station.status === 'SLA_EXCEDIDO'
                  ? 'text-red-700 font-semibold'
                  : station.status === 'LLAMANDO'
                    ? 'text-[#0f172a] font-semibold'
                    : 'text-slate-700'
            }`}
          >
            {station.statusFooterText}
          </span>
        </div>
        {/* Footer derecho — turnos del día */}
        <span className="text-[11px] font-mono text-slate-600 flex-shrink-0 ml-2">
          {station.dailyProcessedCount} turnos hoy
        </span>
      </div>
    </article>
  );
});

CubicleCard.displayName = 'CubicleCard';

// Re-export helper para uso en la cola
export { formatWaitTime };

