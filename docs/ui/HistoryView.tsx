import React, { useState } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Filter,
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { historyRecords, setCurrentView } = usePharmacy();
  const [searchTerm, setSearchTerm] = useState('');
  const [slaFilter, setSlaFilter] = useState<'all' | 'compliant' | 'exceeded'>('all');

  const filteredRecords = historyRecords.filter((rec) => {
    const matchesSearch =
      rec.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.cubicleName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSla =
      slaFilter === 'all'
        ? true
        : slaFilter === 'compliant'
        ? rec.slaCompliant
        : !rec.slaCompliant;

    return matchesSearch && matchesSla;
  });

  const handleExportCSV = () => {
    const headers = 'ID,Ticket,Cubiculo,Operador,Prioridad,Duracion_Seg,SLA_Compliant,Estado\n';
    const rows = filteredRecords
      .map(
        (r) =>
          `"${r.id}","${r.ticketId}","${r.cubicleName}","${r.operator}","${r.priority}",${r.durationSeconds},${r.slaCompliant},"${r.status}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_operativa_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 lg:px-8 py-6 flex flex-col gap-6">
        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[#475569] text-xs mb-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#006591] font-semibold">
                SCR-ADM-003
              </span>
              <span>·</span>
              <span>Auditoría Operativa de Tiempos y Despacho</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('admin')}
                className="p-1 rounded hover:bg-[#eff4ff] text-[#006591]"
                title="Volver a métricas"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl md:text-2xl text-[#001428] tracking-tight font-bold">
                [SCR-ADM-003] Historial · Registro Operativo Diario
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#CBD5E1] hover:bg-[#eff4ff] text-[#001428] text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#006591]" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={() => setCurrentView('admin')}
              className="px-3 py-2 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#001428] text-xs font-semibold rounded-lg border border-[#CBD5E1]"
            >
              ← Volver al Panel General
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código de turno o puesto..."
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#006591] text-[#001428]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B] flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> SLA:
            </span>
            <div className="flex bg-[#eff4ff] p-1 rounded-lg border border-[#E2E8F0]">
              <button
                onClick={() => setSlaFilter('all')}
                className={`px-3 py-1 text-xs rounded transition-all font-medium ${
                  slaFilter === 'all'
                    ? 'bg-[#0F2942] text-white font-semibold'
                    : 'text-[#475569] hover:text-[#001428]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSlaFilter('compliant')}
                className={`px-3 py-1 text-xs rounded transition-all font-medium ${
                  slaFilter === 'compliant'
                    ? 'bg-[#065F46] text-white font-semibold'
                    : 'text-[#475569] hover:text-[#001428]'
                }`}
              >
                En Norma (&lt;8m)
              </button>
              <button
                onClick={() => setSlaFilter('exceeded')}
                className={`px-3 py-1 text-xs rounded transition-all font-medium ${
                  slaFilter === 'exceeded'
                    ? 'bg-[#ba1a1a] text-white font-semibold'
                    : 'text-[#475569] hover:text-[#001428]'
                }`}
              >
                Excedidos
              </button>
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#eff4ff] text-[#475569] font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4">Código de Turno</th>
                  <th className="py-3 px-4">Puesto Asignado</th>
                  <th className="py-3 px-4">Operador</th>
                  <th className="py-3 px-4">Prioridad</th>
                  <th className="py-3 px-4">Tiempo de Atención</th>
                  <th className="py-3 px-4">Cumplimiento SLA</th>
                  <th className="py-3 px-4 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#64748B]">
                      No se encontraron registros con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const mins = Math.floor(rec.durationSeconds / 60);
                    const secs = rec.durationSeconds % 60;
                    const durationStr = `${mins}m ${secs}s`;

                    return (
                      <tr key={rec.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#001428]">
                          {rec.ticketId}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#001428]">
                          {rec.cubicleName}
                        </td>
                        <td className="py-3 px-4 text-[#475569]">
                          {rec.operator}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] font-semibold text-[#006591]">
                          {rec.priority.toUpperCase()}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[#001428]">
                          {durationStr}
                        </td>
                        <td className="py-3 px-4">
                          {rec.slaCompliant ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                              Cumplido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ba1a1a] bg-[#ffdad6] px-2 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 text-[#ba1a1a]" />
                              Desviado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                              rec.status === 'completed'
                                ? 'bg-[#eff4ff] text-[#006591]'
                                : 'bg-[#e5eeff] text-[#64748B]'
                            }`}
                          >
                            {rec.status === 'completed' ? 'FINALIZADO' : 'ABANDONADO'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
