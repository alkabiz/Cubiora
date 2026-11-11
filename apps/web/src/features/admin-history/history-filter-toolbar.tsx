// ─── [SCR-ADM-003] HistoryFilterToolbar — Barra de Búsqueda y Filtro SLA ──────
import React from 'react';
import { Search, Filter } from 'lucide-react';
import type { SlaFilterOption } from './types';

interface HistoryFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  slaFilter: SlaFilterOption;
  onSlaFilterChange: (option: SlaFilterOption) => void;
  slaTargetMinutes?: number | null;
}

export const HistoryFilterToolbar: React.FC<HistoryFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  slaFilter,
  onSlaFilterChange,
  slaTargetMinutes = null,
}) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
      {/* Izquierda: Buscador con label accesible y foco visible (WCAG 1.4.3, 2.4.7 AA) */}
      <div className="relative w-full sm:w-96">
        <label htmlFor="history-search-input" className="sr-only">
          Buscar por código de turno o puesto
        </label>
        <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <input
          id="history-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por código de turno o puesto..."
          className="w-full bg-[#F8FAFC] border border-slate-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
        />
      </div>

      {/* Derecha: Selector Segmentado de SLA con foco visible y target size >= 24px (WCAG 2.4.7, 2.5.8 AA) */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
          <Filter className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
          <span>SLA:</span>
        </div>

        <div className="bg-[#F8FAFC] p-1 rounded-xl border border-slate-200/80 inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSlaFilterChange('ALL')}
            className={`min-h-[32px] px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-1 ${
              slaFilter === 'ALL'
                ? 'bg-[#0F766E] text-white font-semibold shadow-2xs'
                : 'text-slate-700 hover:text-slate-950 font-medium'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onSlaFilterChange('IN_NORM')}
            className={`min-h-[32px] px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-1 ${
              slaFilter === 'IN_NORM'
                ? 'bg-[#0F766E] text-white font-semibold shadow-2xs'
                : 'text-slate-700 hover:text-slate-950 font-medium'
            }`}
          >
            {slaTargetMinutes ? `En Norma (≤${slaTargetMinutes}m)` : 'En Norma'}
          </button>
          <button
            type="button"
            onClick={() => onSlaFilterChange('EXCEEDED')}
            className={`min-h-[32px] px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-1 ${
              slaFilter === 'EXCEEDED'
                ? 'bg-[#0F766E] text-white font-semibold shadow-2xs'
                : 'text-slate-700 hover:text-slate-950 font-medium'
            }`}
          >
            Excedidos
          </button>
        </div>
      </div>
    </div>
  );
};

