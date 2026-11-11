// ─── SCR-ADM-001 · QueueItemCard ─────────────────────────────────────────────
import React from 'react';
import type { QueuedTicket } from './types';
import { formatWaitTime } from './use-operational-telemetry';

interface QueueItemCardProps {
  ticket: QueuedTicket;
}

export const QueueItemCard: React.FC<QueueItemCardProps> = React.memo(({ ticket }) => {
  const isPreferential = ticket.priority === 'PREFERENCIAL';

  return (
    <article
      className={`bg-white rounded-xl p-3.5 border shadow-[0_1px_3px_rgb(0_0_0/0.06)] ${
        isPreferential ? 'border-[#0081cf]' : 'border-amber-200/90'
      }`}
    >
      {/* ── Fila superior ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Número de posición */}
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex-shrink-0">
            {ticket.position}
          </span>
          {/* Código de turno */}
          <span className="text-sm font-mono font-bold text-slate-800 truncate">
            {ticket.ticketCode}
          </span>
        </div>

        {/* Badge de prioridad */}
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${
            isPreferential
              ? 'bg-[#0081cf]/12 text-[#0f172a] border border-[#0081cf]'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          {ticket.priority}
        </span>
      </div>

      {/* ── Fila inferior ── */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] font-mono text-slate-600">
          Emisión: {ticket.issuedAt}
        </span>
        <span className="text-[11px] font-mono text-slate-600 font-semibold tabular-nums">
          Tiempo en espera:{' '}
          <span className="text-amber-700 font-bold">
            {formatWaitTime(ticket.waitingSeconds)}
          </span>
        </span>
      </div>
    </article>
  );
});

QueueItemCard.displayName = 'QueueItemCard';

