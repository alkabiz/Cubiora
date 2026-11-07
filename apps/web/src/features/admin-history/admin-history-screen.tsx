// ─── [SCR-ADM-003] Historial · Registro Operativo Diario ─────────────────────
import React, { useState, useMemo } from 'react';
import { HistoryHeader } from './history-header';
import { HistoryFilterToolbar } from './history-filter-toolbar';
import { DailyAuditTable } from './daily-audit-table';
import { exportAuditRecordsToCsv } from './csv-export';
import { INITIAL_AUDIT_RECORDS } from './mock-history-data';
import type { DailyAuditRecord, SlaFilterOption } from './types';

export const AdminHistoryScreen: React.FC = () => {
  const [records] = useState<DailyAuditRecord[]>(INITIAL_AUDIT_RECORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<SlaFilterOption>('ALL');

  // Filtrado reactivo en memoria
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Filtrado por texto (código de turno, puesto u operador)
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = r.ticketCode.toLowerCase().includes(q);
        const matchesStation = r.assignedStation.toLowerCase().includes(q);
        const matchesOperator = r.operatorName.toLowerCase().includes(q);

        if (!matchesCode && !matchesStation && !matchesOperator) {
          return false;
        }
      }

      // 2. Filtrado por SLA
      if (slaFilter === 'IN_NORM') {
        // En Norma: < 8 minutos (480 segundos) y cumplido
        if (!r.slaCompliant || r.serviceDurationSeconds >= 480) {
          return false;
        }
      } else if (slaFilter === 'EXCEEDED') {
        // Excedidos: >= 8 minutos o no cumplido
        if (r.slaCompliant && r.serviceDurationSeconds < 480) {
          return false;
        }
      }

      return true;
    });
  }, [records, searchQuery, slaFilter]);

  const handleExportCsv = () => {
    exportAuditRecordsToCsv(filteredRecords);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-8 space-y-5">
      {/* ═══════════════ HEADER SUPERIOR DE PÁGINA ═══════════════ */}
      <HistoryHeader onExportCsv={handleExportCsv} />

      {/* ═══════════════ BARRA DE BÚSQUEDA Y FILTRO SLA ═══════════════ */}
      <HistoryFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        slaFilter={slaFilter}
        onSlaFilterChange={setSlaFilter}
      />

      {/* ═══════════════ TABLA DE REGISTRO OPERATIVO DIARIO ═══════════════ */}
      <DailyAuditTable records={filteredRecords} />
    </div>
  );
};
