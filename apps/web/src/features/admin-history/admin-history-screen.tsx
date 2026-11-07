// ─── [SCR-ADM-003] Historial · Registro Operativo Diario ─────────────────────
import React, { useState, useMemo, useEffect } from 'react';
import { DispensationResolution, QueueCategory, TicketStatus, type TicketHistoryResponse } from '@cubiora/shared';
import { apiClient } from '../../lib/api';
import { HistoryHeader } from './history-header';
import { HistoryFilterToolbar } from './history-filter-toolbar';
import { DailyAuditTable } from './daily-audit-table';
import { exportAuditRecordsToCsv } from './csv-export';
import { INITIAL_AUDIT_RECORDS } from './mock-history-data';
import type { DailyAuditRecord, SlaFilterOption } from './types';

export const AdminHistoryScreen: React.FC = () => {
  const [records, setRecords] = useState<DailyAuditRecord[]>(INITIAL_AUDIT_RECORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<SlaFilterOption>('ALL');

  useEffect(() => {
    let isMounted = true;
    apiClient<{ success: boolean; data: TicketHistoryResponse }>('/tickets/history?limit=100')
      .then((res) => {
        const historyData = res.data ?? (res as unknown as TicketHistoryResponse);
        if (isMounted && historyData && historyData.items && historyData.items.length > 0) {
          const mapped: DailyAuditRecord[] = historyData.items.map((item) => {
            const mins = Math.floor(item.serviceDurationSeconds / 60);
            const secs = item.serviceDurationSeconds % 60;
            let priority: DailyAuditRecord['priority'] = 'GENERAL';
            if (item.queueCategory === QueueCategory.PREFERENTIAL) priority = 'PREFERENCIAL';
            else if (item.queueCategory === QueueCategory.HIGH_COST) priority = 'ALTO_COSTO';
            else if (item.queueCategory === QueueCategory.BILLING) priority = 'FACTURACION';

            let resultStatus: DailyAuditRecord['resultStatus'] = 'FINALIZADO';
            if (item.status === TicketStatus.NO_SHOW) {
              resultStatus = 'ABANDONADO';
            } else if (item.dispensation?.resolution === DispensationResolution.PENDING_48H) {
              resultStatus = 'PENDING_48H';
            }

            return {
              id: item.id,
              ticketCode: item.publicCode,
              assignedStation: item.assignedStation,
              operatorName: item.operatorName,
              priority,
              serviceDurationSeconds: item.serviceDurationSeconds,
              serviceDurationFormatted: `${mins}m ${secs}s`,
              slaCompliant: item.slaCompliant,
              resultStatus,
              dispensationResolution: item.dispensation?.resolution,
              prescriptionBarcode: item.dispensation?.prescriptionCode,
            };
          });
          setRecords(mapped);
        }
      })
      .catch(() => {
        // En caso de error o estar sin conexión, se preserva el estado inicial
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtrado reactivo en memoria
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Filtrado por texto (código de turno, puesto u operador)
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = r.ticketCode.toLowerCase().includes(q);
        const matchesStation = r.assignedStation.toLowerCase().includes(q);
        const matchesOperator = r.operatorName.toLowerCase().includes(q);
        const matchesPriority = r.priority.toLowerCase().includes(q);
        const matchesResolution = r.dispensationResolution?.toLowerCase().includes(q);
        const matchesPrescription = r.prescriptionBarcode?.toLowerCase().includes(q);

        if (!matchesCode && !matchesStation && !matchesOperator && !matchesPriority && !matchesResolution && !matchesPrescription) {
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
