// ─── [SCR-PUB-001] BroadcastNoticeBar — Barra Inferior de Avisos Institucionales ──
import React from 'react';
import { AlertTriangle, Info, Megaphone } from 'lucide-react';
import type { PublicDisplayNotice } from './types';

interface BroadcastNoticeBarProps {
  notice?: PublicDisplayNotice | null;
}

export const BroadcastNoticeBar: React.FC<BroadcastNoticeBarProps> = ({ notice }) => {
  if (notice && notice.message.trim().length > 0) {
    const severity = String(notice.severity).toLowerCase();

    if (severity === 'critical') {
      return (
        <div
          role="alert"
          className="mx-4 sm:mx-8 mb-4 sm:mb-6 px-4 sm:px-6 py-3.5 rounded-2xl bg-red-500/20 border border-red-400/50 text-red-100 flex items-center gap-3 text-sm font-semibold"
        >
          <AlertTriangle className="w-5 h-5 text-red-300 flex-shrink-0" aria-hidden="true" />
          <span>{notice.message}</span>
        </div>
      );
    }

    if (severity === 'info') {
      return (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 sm:mx-8 mb-4 sm:mb-6 px-4 sm:px-6 py-3.5 rounded-2xl bg-sky-500/15 border border-sky-400/40 text-sky-100 flex items-center gap-3 text-sm font-medium"
        >
          <Info className="w-5 h-5 text-sky-300 flex-shrink-0" aria-hidden="true" />
          <span>{notice.message}</span>
        </div>
      );
    }

    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-4 sm:mx-8 mb-4 sm:mb-6 px-4 sm:px-6 py-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/45 text-amber-100 flex items-center gap-3 text-sm font-medium"
      >
        <Megaphone className="w-5 h-5 text-amber-300 flex-shrink-0" aria-hidden="true" />
        <span>{notice.message}</span>
      </div>
    );
  }

  return (
    <footer className="px-4 sm:px-8 py-3 bg-[#04101E] border-t border-slate-800/80 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
      <span>
        Por favor tenga a la mano su orden y fórmula médica al acercarse al cubículo asignado.
      </span>
      <span className="font-mono text-slate-300">
        Cubiora · Sistema de Gestión de Turnos
      </span>
    </footer>
  );
};

