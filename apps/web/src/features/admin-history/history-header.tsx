// ─── [SCR-ADM-003] HistoryHeader — Cabecera de Navegación y Acciones ──────────
import React from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PageHeader } from '../../app/page-header';

interface HistoryHeaderProps {
  onExportCsv: () => void;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = ({ onExportCsv }) => {
  return (
    <PageHeader
      section="Auditoría Operativa de Tiempos y Despacho"
      backTo="/admin"
      backLabel="Volver al panel general"
      title="Historial Operativo Diario"
      action={
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-500 rounded-lg px-3.5 py-2 min-h-[36px] text-xs font-semibold shadow-2xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2] focus-visible:ring-offset-2"
          >
            <Download className="w-3.5 h-3.5 text-[#2c73d2]" aria-hidden="true" />
            Exportar CSV
          </button>

          <Link
            to="/admin"
            className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-500 rounded-lg px-3.5 py-2 min-h-[36px] text-xs font-semibold shadow-2xs transition-colors inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2] focus-visible:ring-offset-2"
          >
            ← Volver al Panel General
          </Link>
        </div>
      }
    />
  );
};

