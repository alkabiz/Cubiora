// ─── [SCR-ADM-003] Utilidad de Exportación CSV con Soporte UTF-8 (BOM) ─────────
import type { DailyAuditRecord } from './types';

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportAuditRecordsToCsv(
  records: DailyAuditRecord[],
  filenamePrefix = 'cubiora-registro-operativo-diario',
): void {
  const headers = [
    'Codigo de Turno',
    'Puesto Asignado',
    'Operador',
    'Prioridad',
    'Tiempo de Atencion',
    'Cumplimiento SLA',
    'Resultado',
  ];

  const rows = records.map((r) => [
    escapeCsvField(r.ticketCode),
    escapeCsvField(r.assignedStation),
    escapeCsvField(r.operatorName),
    escapeCsvField(r.priority),
    escapeCsvField(r.serviceDurationFormatted),
    escapeCsvField(r.slaCompliant ? 'Cumplido' : 'Excedido'),
    escapeCsvField(r.resultStatus),
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}-${dateStr}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
