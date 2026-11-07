// ─── [SCR-ADM-003] Historial · Registro Operativo Diario — Tipos ─────────────

export type SlaFilterOption = 'ALL' | 'IN_NORM' | 'EXCEEDED';
export type AuditPriority = 'GENERAL' | 'PREFERENCIAL';
export type AuditResultStatus = 'FINALIZADO' | 'ABANDONADO';

export interface DailyAuditRecord {
  id: string;
  ticketCode: string; // ej. 'TUR-000119-L2'
  assignedStation: string; // ej. 'Cubículo 04'
  operatorName: string; // ej. 'Farm. S. Quintero'
  priority: AuditPriority; // 'GENERAL' | 'PREFERENCIAL'
  serviceDurationSeconds: number;
  serviceDurationFormatted: string; // ej. '6m 52s'
  slaCompliant: boolean; // true -> 'Cumplido', false -> 'Excedido'
  resultStatus: AuditResultStatus;
}
