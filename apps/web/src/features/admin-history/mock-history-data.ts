// ─── [SCR-ADM-003] Datos Iniciales Semilla de Auditoría Diaria ───────────────
import type { DailyAuditRecord } from './types';

export const INITIAL_AUDIT_RECORDS: DailyAuditRecord[] = [
  {
    id: 'aud_001',
    ticketCode: 'TUR-000119-L2',
    assignedStation: 'Cubículo 04',
    operatorName: 'Farm. S. Quintero',
    priority: 'GENERAL',
    serviceDurationSeconds: 412,
    serviceDurationFormatted: '6m 52s',
    slaCompliant: true,
    resultStatus: 'FINALIZADO',
  },
  {
    id: 'aud_002',
    ticketCode: 'TUR-000118-H1',
    assignedStation: 'Cubículo 03',
    operatorName: 'Lic. R. Mendoza',
    priority: 'PREFERENCIAL',
    serviceDurationSeconds: 420,
    serviceDurationFormatted: '7m 0s',
    slaCompliant: true,
    resultStatus: 'FINALIZADO',
  },
  {
    id: 'aud_003',
    ticketCode: 'TUR-000117-K9',
    assignedStation: 'Cubículo 01',
    operatorName: 'Lic. M. Arismendi',
    priority: 'GENERAL',
    serviceDurationSeconds: 420,
    serviceDurationFormatted: '7m 0s',
    slaCompliant: true,
    resultStatus: 'FINALIZADO',
  },
  {
    id: 'aud_004',
    ticketCode: 'TUR-000116-X3',
    assignedStation: 'Cubículo 02',
    operatorName: 'Farm. J. Duarte',
    priority: 'GENERAL',
    serviceDurationSeconds: 120,
    serviceDurationFormatted: '2m 0s',
    slaCompliant: true,
    resultStatus: 'ABANDONADO',
  },
];
