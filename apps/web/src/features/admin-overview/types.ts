// ─── SCR-ADM-001 · CMP-ADM-001 — Tipos de datos de telemetría operativa ───────
import type {
  TelemetryDailyKpis,
  TelemetrySlaAlert,
} from '@cubiora/shared';

export type CubicleStatus =
  | 'ATENDIENDO'
  | 'SLA_EXCEDIDO'
  | 'LLAMANDO'
  | 'DISPONIBLE'
  | 'INACTIVO';

export type QueuePriority = 'PREFERENCIAL' | 'GENERAL';

export interface CubicleStation {
  id: string;
  name: string;
  moduleCode: 'MOD-A' | 'MOD-B' | 'MOD-C';
  status: CubicleStatus;
  assignedTicket: string | null;
  operatorName: string | null;
  /** Tiempo transcurrido formateado — se actualiza en tiempo real vía hook */
  elapsedTimeFormatted: string;
  /** Segundos transcurridos desde inicio — base para el tick del reloj */
  elapsedSeconds: number;
  statusFooterText: string;
  dailyProcessedCount: number;
  /** Cuando true la tarjeta ocupa el ancho completo de la grilla */
  fullWidth?: boolean;

  // Timestamps base del servidor para cálculo Date.now() - timestamp sin deriva de reloj
  startedAtIso?: string | null;
  idleSinceIso?: string | null;
  calledAtIso?: string | null;
  stateChangedAtIso?: string | null;
  slaThresholdSeconds?: number;
}

export interface QueuedTicket {
  position: number;
  ticketCode: string;
  priority: QueuePriority;
  issuedAt: string; // HH:mm:ss
  /** Segundos en espera — base para el tick del reloj */
  waitingSeconds: number;
  /** ISO timestamp para cálculo Date.now() - issuedAt */
  issuedAtIso?: string;
}

export interface KpiCardData {
  label: string;
  mainValue: string;
  mainUnit: string;
  secondaryValue: string;
  secondaryLabel: string;
  footerContent: React.ReactNode;
}

export interface HourlyFlowEntry {
  hour: string;
  isCurrentHour?: boolean;
  volume: number;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'fallback';

export interface OperationalTelemetryHookResult {
  cubicles: CubicleStation[];
  queue: QueuedTicket[];
  kpis: TelemetryDailyKpis;
  slaAlert: TelemetrySlaAlert;
  hourlyFlow: HourlyFlowEntry[];
  connectionStatus: ConnectionStatus;
  latencyMs: number;
  forceRefresh: () => void;
  sendBroadcastNotice: (message: string, severity?: 'info' | 'warning' | 'critical') => void;
}
