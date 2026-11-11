// ─── [SCR-ADM-003] DailyAuditTable — Tabla de Registro Operativo Diario ───────
import React from 'react';
import { CheckCircle2, AlertCircle, Star, History } from 'lucide-react';
import type { DailyAuditRecord } from './types';

interface DailyAuditTableProps {
  records: DailyAuditRecord[];
  pageSize?: number;
  isLoading?: boolean;
  hasActiveFilter?: boolean;
  onInspectTimeline?: (record: DailyAuditRecord) => void;
}

export const DailyAuditTable: React.FC<DailyAuditTableProps> = ({
  records,
  pageSize = 25,
  isLoading = false,
  hasActiveFilter = false,
  onInspectTimeline,
}) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));

  // Reiniciar a página 1 si los filtros reducen el conjunto de resultados
  React.useEffect(() => {
    setCurrentPage(1);
  }, [records.length]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRecords = records.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-left border-collapse" aria-rowcount={records.length}>
          <thead className="sticky top-0 bg-[#F8FAFC] z-10 shadow-2xs">
            {/* Cabecera con contraste accesible WCAG 1.4.3 (text-slate-700 sobre #F8FAFC: 9.90:1) */}
            <tr className="border-b border-slate-200/90 text-[11px] font-bold text-slate-700">
              <th scope="col" className="py-3.5 px-6 text-left">Código de Turno</th>
              <th scope="col" className="py-3.5 px-6 text-left">Puesto Asignado</th>
              <th scope="col" className="py-3.5 px-6 text-left">Operador</th>
              <th scope="col" className="py-3.5 px-6 text-left">Prioridad</th>
              <th scope="col" className="py-3.5 px-6 text-left">Tiempo de Atención</th>
              <th scope="col" className="py-3.5 px-6 text-left">Cumplimiento SLA</th>
              <th scope="col" className="py-3.5 px-6 text-right">Resultado</th>
              <th scope="col" className="py-3.5 px-6 text-right">Trazabilidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 px-6 text-center text-slate-700 text-xs font-medium"
                >
                  {isLoading
                    ? 'Cargando historial operativo...'
                    : hasActiveFilter
                      ? 'No se encontraron registros que coincidan con los criterios de filtro.'
                      : 'No hay registros operativos finalizados aún.'}
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record, index) => (
                <tr key={record.id} className="hover:bg-slate-50/60 transition-colors" aria-rowindex={startIndex + index + 1}>
                  {/* 1. Código de Turno */}
                  <td className="font-mono font-bold text-slate-900 py-4 px-6 whitespace-nowrap">
                    {record.ticketCode}
                  </td>

                  {/* 2. Puesto Asignado */}
                  <td className="font-medium text-slate-800 py-4 px-6 whitespace-nowrap">
                    {record.assignedStation}
                  </td>

                  {/* 3. Operador con contraste accesible (WCAG 1.4.3 AA: >= 4.5:1) */}
                  <td className="text-slate-700 py-4 px-6 whitespace-nowrap">
                    {record.operatorName}
                  </td>

                  {/* 4. Prioridad con jerarquía visual adecuada: PREFERENCIAL resaltado, GENERAL neutro (Nielsen H8) */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    {record.priority === 'PREFERENCIAL' ? (
                      <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-800 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        <Star className="w-3 h-3 text-purple-700 fill-purple-700/20" aria-hidden="true" />
                        PREFERENCIAL
                      </span>
                    ) : record.priority === 'ALTO_COSTO' ? (
                      <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-300 text-purple-900 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Alto Costo
                      </span>
                    ) : record.priority === 'FACTURACION' ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Facturación
                      </span>
                    ) : (
                      <span className="font-mono text-xs font-medium text-slate-600 tracking-wide uppercase">
                        GENERAL
                      </span>
                    )}
                  </td>

                  {/* 5. Tiempo de Atención */}
                  <td className="font-mono font-medium text-slate-800 py-4 px-6 whitespace-nowrap">
                    {record.serviceDurationFormatted}
                  </td>

                  {/* 6. Cumplimiento SLA */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    {record.slaCompliant ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                        Cumplido
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-800 px-2.5 py-1 rounded-md text-xs font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                        Excedido
                      </span>
                    )}
                  </td>

                  {/* 7. Resultado */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    {record.resultStatus === 'PENDING_48H' ? (
                      <span className="bg-amber-50 text-amber-900 border border-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                        Pendiente 48h
                      </span>
                    ) : record.resultStatus === 'FINALIZADO' ? (
                      <span className="bg-blue-50/90 text-blue-800 font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                        FINALIZADO
                      </span>
                    ) : record.resultStatus === 'CANCELADO' ? (
                      <span className="bg-rose-50 text-rose-800 border border-rose-200 font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                        CANCELADO
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-700 font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                        ABANDONADO
                      </span>
                    )}
                  </td>

                  {/* 8. Trazabilidad */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={!record.publicId}
                      onClick={() => onInspectTimeline?.(record)}
                      aria-label={`Ver trazabilidad del turno ${record.ticketCode}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793]"
                    >
                      <History className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                      Ver trazabilidad
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de paginación accesible (WCAG 2.1.1, 2.5.8 AA) — se activa cuando el volumen supera la página */}
      {records.length > pageSize && (
        <nav
          aria-label="Paginación de auditoría diaria"
          className="bg-[#F8FAFC] border-t border-slate-200/80 px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-700 font-medium"
        >
          <div>
            Mostrando <span className="font-mono font-bold text-slate-900">{startIndex + 1}</span> a{' '}
            <span className="font-mono font-bold text-slate-900">
              {Math.min(startIndex + pageSize, records.length)}
            </span>{' '}
            de <span className="font-mono font-bold text-slate-900">{records.length}</span> registros
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793] transition-colors cursor-pointer"
            >
              Anterior
            </button>
            <span className="font-mono text-slate-700 px-2" aria-current="page">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793] transition-colors cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

