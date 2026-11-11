// ─── [SCR-ADM-003] Historial · Registro Operativo Diario — Tipos ─────────────

export type SlaFilterOption = 'ALL' | 'IN_NORM' | 'EXCEEDED';
export type AuditPriority = 'GENERAL' | 'PREFERENCIAL' | 'ALTO_COSTO' | 'FACTURACION';
export type AuditResultStatus = 'FINALIZADO' | 'ABANDONADO' | 'CANCELADO' | 'PENDING_48H';

export interface DailyAuditRecord {
  id: string;
  publicId?: string;
  ticketCode: string; // ej. 'TUR-000119-L2'
  assignedStation: string; // ej. 'Cubículo 04'
  operatorName: string; // ej. 'Farm. S. Quintero'
  priority: AuditPriority; // 'GENERAL' | 'PREFERENCIAL' | 'ALTO_COSTO' | 'FACTURACION'
  serviceDurationSeconds: number;
  serviceDurationFormatted: string; // ej. '6m 52s'
  slaCompliant: boolean; // true -> 'Cumplido', false -> 'Excedido'
  resultStatus: AuditResultStatus;
  terminalReason?: string | null;
  dispensationResolution?: string | null;
  prescriptionBarcode?: string | null;
}
