// ─── [SCR-ADM-003] HistoryHeader — Cabecera de Navegación y Acciones ──────────
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';

interface HistoryHeaderProps {
  onExportCsv: () => void;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = ({ onExportCsv }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Izquierda: Breadcrumbs y Título con contraste accesible (WCAG 1.4.3 AA: >= 4.5:1) */}
      <div>
        <div className="flex items-center text-xs">
          <span className="font-mono font-bold text-blue-800">SCR-ADM-003</span>
          <span className="text-slate-600 mx-1.5" aria-hidden="true">·</span>
          <span className="text-slate-700 font-medium">Auditoría Operativa de Tiempos y Despacho</span>
          <span className="sr-only">SCR-ADM-003 · Auditoría básica</span>
        </div>

        <div className="flex items-center gap-2.5 mt-1">
          <Link
            to="/admin"
            aria-label="Volver al panel general"
            className="text-blue-800 hover:text-blue-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793] focus-visible:ring-offset-2 rounded-md p-1"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            [SCR-ADM-003] Historial · Registro Operativo Diario
          </h1>
          <h2 className="sr-only">Historial de turnos</h2>
        </div>
      </div>

      {/* Derecha: Botón Exportar CSV y Volver con foco visible y target size >= 24x24 px (WCAG 2.4.7, 2.5.8 AA) */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg px-3.5 py-2 min-h-[32px] text-xs font-semibold shadow-2xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793] focus-visible:ring-offset-2"
        >
          <Download className="w-3.5 h-3.5 text-blue-800" aria-hidden="true" />
          Exportar CSV
        </button>

        <Link
          to="/admin"
          className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg px-3.5 py-2 min-h-[32px] text-xs font-semibold shadow-2xs transition-colors inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793] focus-visible:ring-offset-2"
        >
          ← Volver al Panel General
        </Link>
      </div>
    </div>
  );
};

