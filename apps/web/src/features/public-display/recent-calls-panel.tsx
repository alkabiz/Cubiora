// ─── [SCR-PUB-001] RecentCallsPanel — Panel Lateral de Llamados Recientes ──────
import React from 'react';
import type { PublicTicketCall } from './types';

interface RecentCallsPanelProps {
  recentCalls: PublicTicketCall[];
}

export const RecentCallsPanel: React.FC<RecentCallsPanelProps> = ({ recentCalls }) => {
  const visibleCalls = recentCalls.slice(0, 4);

  return (
    <aside
      aria-label="Llamados recientes"
      className="col-span-12 lg:col-span-4 rounded-3xl bg-[#041222] border border-slate-800/90 p-6 flex flex-col justify-between"
    >
      <div>
        {/* Cabecera del Panel */}
        <div className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300 pb-4 mb-4 border-b border-slate-800">
          Llamados recientes
        </div>

        {/* Lista de Tarjetas Recientes con Prevención Estricta de Colisiones */}
        <ul role="list" className="space-y-3.5">
          {visibleCalls.length === 0 ? (
            <li className="py-8 text-center text-slate-500 text-sm">
              Sin llamados previos
            </li>
          ) : (
            visibleCalls.map((item, index) => {
              const isFirst = index === 0;
              return (
                <li
                  key={`${item.ticketCode}-${index}`}
                  className={`flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border transition-colors ${
                    isFirst
                      ? 'bg-[#07203B] border-sky-500/30'
                      : 'bg-[#061A30]/90 border border-slate-800/90'
                  }`}
                >
                  {/* Código de Turno a la izquierda */}
                  <span className="font-mono font-bold text-xl text-white tabular-nums tracking-tight">
                    {item.ticketCode}
                  </span>

                  {/* Badge de Cubículo a la derecha */}
                  <span className="inline-flex items-center px-3.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold text-base whitespace-nowrap">
                    {item.cubicleName}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Pie del Panel Lateral */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80 text-xs font-mono text-slate-400">
        <span className="uppercase tracking-wider">ATENCIÓN CONTINUA</span>
        <span className="tabular-nums font-semibold text-slate-300">
          {visibleCalls.length} en historial
        </span>
      </div>
    </aside>
  );
};

