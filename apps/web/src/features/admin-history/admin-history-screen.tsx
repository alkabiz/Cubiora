// ─── [SCR-ADM-003] Historial · Registro Operativo Diario ─────────────────────
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Callout } from '@radix-ui/themes';
import {
  DispensationResolution,
  QueueCategory,
  TicketStatus,
  type TicketHistoryResponse,
} from '@cubiora/shared';
import { apiClient } from '../../lib/api';
import { HistoryHeader } from './history-header';
import { HistoryFilterToolbar } from './history-filter-toolbar';
import { DailyAuditTable } from './daily-audit-table';
import { TicketTimelineDialog } from './ticket-timeline-dialog';
import { exportAuditRecordsToCsv } from './csv-export';
import type { DailyAuditRecord, SlaFilterOption } from './types';

function mapHistoryItems(historyData: TicketHistoryResponse): DailyAuditRecord[] {
  return historyData.items.map((item) => {
    const mins = Math.floor(item.serviceDurationSeconds / 60);
    const secs = item.serviceDurationSeconds % 60;
    let priority: DailyAuditRecord['priority'] = 'GENERAL';
    if (item.queueCategory === QueueCategory.PREFERENTIAL) priority = 'PREFERENCIAL';
    else if (item.queueCategory === QueueCategory.HIGH_COST) priority = 'ALTO_COSTO';
    else if (item.queueCategory === QueueCategory.BILLING) priority = 'FACTURACION';

    let resultStatus: DailyAuditRecord['resultStatus'] = 'FINALIZADO';
    if (item.status === TicketStatus.NO_SHOW) {
      resultStatus = 'ABANDONADO';
    } else if (item.status === TicketStatus.CANCELLED) {
      resultStatus = 'CANCELADO';
    } else if (item.dispensation?.resolution === DispensationResolution.PENDING_48H) {
      resultStatus = 'PENDING_48H';
    }

    return {
      id: item.id,
      publicId: item.publicId,
      ticketCode: item.publicCode,
      assignedStation: item.assignedStation,
      operatorName: item.operatorName,
      priority,
      serviceDurationSeconds: item.serviceDurationSeconds,
      serviceDurationFormatted: `${mins}m ${secs}s`,
      slaCompliant: item.slaCompliant,
      resultStatus,
      terminalReason: item.terminalReason ?? null,
      dispensationResolution: item.dispensation?.resolution,
      prescriptionBarcode: item.dispensation?.prescriptionCode,
    };
  });
}

export const AdminHistoryScreen: React.FC = () => {
  const [records, setRecords] = useState<DailyAuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slaTargetSeconds, setSlaTargetSeconds] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<SlaFilterOption>('ALL');
  const [serverPage, setServerPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [inspectedRecord, setInspectedRecord] = useState<DailyAuditRecord | null>(null);
  const isMountedRef = useRef(true);

  const loadHistory = useCallback(
    (targetPage = 1, options?: { search?: string; slaFilter?: SlaFilterOption }) => {
      setIsLoading(true);
      setLoadError(null);

      const params = new URLSearchParams({ limit: '100' });
      if (targetPage > 1) {
        params.set('page', String(targetPage));
      }
      const trimmedSearch = options?.search?.trim();
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }
      if (options?.slaFilter && options.slaFilter !== 'ALL') {
        params.set('slaFilter', options.slaFilter);
      }

      apiClient<{ success: boolean; data: TicketHistoryResponse }>(
        `/tickets/history?${params.toString()}`,
      )
        .then((res) => {
          if (!isMountedRef.current) return;
          const historyData = res.data ?? (res as unknown as TicketHistoryResponse);
          if (historyData && typeof historyData.slaThresholdSeconds === 'number') {
            setSlaTargetSeconds(historyData.slaThresholdSeconds);
          }
          if (historyData && Array.isArray(historyData.items)) {
            setRecords(mapHistoryItems(historyData));
            setServerPage(
              typeof historyData.page === 'number' && historyData.page >= 1
                ? historyData.page
                : targetPage,
            );
            setServerTotalPages(
              typeof historyData.totalPages === 'number' && historyData.totalPages >= 1
                ? historyData.totalPages
                : 1,
            );
            setServerTotal(
              typeof historyData.total === 'number' ? historyData.total : historyData.items.length,
            );
          } else {
            setRecords([]);
            setServerPage(1);
            setServerTotalPages(1);
            setServerTotal(0);
          }
        })
        .catch(() => {
          if (!isMountedRef.current) return;
          setRecords([]);
          setLoadError('No fue posible cargar el historial operativo del servidor.');
        })
        .finally(() => {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        });
    },
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    loadHistory(1);
    return () => {
      isMountedRef.current = false;
    };
  }, [loadHistory]);

  // Filtrado reactivo en memoria sobre el lote cargado
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

        if (
          !matchesCode &&
          !matchesStation &&
          !matchesOperator &&
          !matchesPriority &&
          !matchesResolution &&
          !matchesPrescription
        ) {
          return false;
        }
      }

      // 2. Filtrado por SLA (evaluado por backend según CUBICLE_DAILY_TARGET_SECONDS)
      if (slaFilter === 'IN_NORM' && !r.slaCompliant) {
        return false;
      }
      if (slaFilter === 'EXCEEDED' && r.slaCompliant) {
        return false;
      }

      return true;
    });
  }, [records, searchQuery, slaFilter]);

  const handleExportCsv = () => {
    exportAuditRecordsToCsv(filteredRecords);
  };

  const handleChangeServerPage = (nextPage: number) => {
    loadHistory(nextPage, { search: searchQuery, slaFilter });
  };

  const slaTargetMinutes =
    slaTargetSeconds && slaTargetSeconds > 0
      ? Math.max(1, Math.round(slaTargetSeconds / 60))
      : null;
  const hasActiveFilter = searchQuery.trim().length > 0 || slaFilter !== 'ALL';

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
        slaTargetMinutes={slaTargetMinutes}
      />

      {loadError && (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertTriangle size={16} aria-hidden="true" />
          </Callout.Icon>
          <div className="flex items-center justify-between gap-3 flex-wrap w-full">
            <Callout.Text>{loadError}</Callout.Text>
            <button
              type="button"
              onClick={() => loadHistory(serverPage, { search: searchQuery, slaFilter })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded-lg bg-white border border-red-300 text-red-800 hover:bg-red-50 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        </Callout.Root>
      )}

      {/* ═══════════════ TABLA DE REGISTRO OPERATIVO DIARIO ═══════════════ */}
      <DailyAuditTable
        records={filteredRecords}
        isLoading={isLoading}
        hasActiveFilter={hasActiveFilter}
        onInspectTimeline={(record) => setInspectedRecord(record)}
      />

      {/* ═══════════════ PAGINACIÓN DE SERVIDOR (> 100 REGISTROS) ═══════════════ */}
      {(serverTotalPages > 1 || serverPage > 1) && (
        <nav
          aria-label="Paginación de resultados del servidor"
          className="bg-white border border-slate-200/90 rounded-2xl px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-700 font-medium shadow-2xs"
        >
          <div>
            Página del servidor <span className="font-mono font-bold text-slate-900">{serverPage}</span> de{' '}
            <span className="font-mono font-bold text-slate-900">{serverTotalPages}</span> (Total:{' '}
            <span className="font-mono font-bold text-slate-900">{serverTotal}</span> registros)
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => loadHistory(1, { search: searchQuery, slaFilter })}
                disabled={isLoading}
                className="px-3 py-1.5 min-h-[32px] rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Aplicar filtro en servidor
              </button>
            )}
            <button
              type="button"
              onClick={() => handleChangeServerPage(Math.max(1, serverPage - 1))}
              disabled={isLoading || serverPage <= 1}
              className="px-3 py-1.5 min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
            >
              Lote anterior
            </button>
            <button
              type="button"
              onClick={() => handleChangeServerPage(Math.min(serverTotalPages, serverPage + 1))}
              disabled={isLoading || serverPage >= serverTotalPages}
              className="px-3 py-1.5 min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
            >
              Siguiente lote
            </button>
          </div>
        </nav>
      )}

      {/* ═══════════════ MODAL DE TRAZABILIDAD DEL TURNO ═══════════════ */}
      <TicketTimelineDialog
        open={Boolean(inspectedRecord)}
        publicId={inspectedRecord?.publicId ?? null}
        ticketCode={inspectedRecord?.ticketCode ?? ''}
        onOpenChange={(open) => {
          if (!open) setInspectedRecord(null);
        }}
      />
    </div>
  );
};
