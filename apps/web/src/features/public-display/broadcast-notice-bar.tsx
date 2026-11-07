// ─── [SCR-PUB-001] BroadcastNoticeBar — Barra Inferior de Avisos Institucionales ──
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PublicDisplayNotice } from './types';

interface BroadcastNoticeBarProps {
  notice?: PublicDisplayNotice | null;
}

export const BroadcastNoticeBar: React.FC<BroadcastNoticeBarProps> = ({ notice }) => {
  if (notice) {
    return (
      <div className="mx-8 mb-6 px-6 py-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center gap-3 text-sm font-medium animate-pulse">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <span>{notice.message}</span>
      </div>
    );
  }

  return (
    <footer className="px-8 py-3 bg-[#04101E] border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
      <span>
        Por favor tenga a la mano su orden y fórmula médica al acercarse al cubículo asignado.
      </span>
      <span className="font-mono text-slate-300">
        Cubiora · Sistema de Gestión de Turnos
      </span>
    </footer>
  );
};

