/**
 * Contrato compartido de eventos WebSocket para el namespace
 * `/operational-telemetry`.
 *
 * REGLA DE PRIVACIDAD: Este archivo NUNCA debe exponer patientName
 * ni patientDocument. Solo se expone publicCode (código de turno).
 */

import { CubicleStatus, QueueCategory } from './enums.js';

// ─── Estados visuales del módulo SCR-ADM-001 ─────────────────────────────────
// Mapeados desde CubicleStatus del dominio al estado visual de supervisor.
export type AdminCubicleVisualStatus =
  | 'ATENDIENDO'   // CubicleStatus.BUSY + tiempo ≤ umbral SLA
  | 'SLA_EXCEDIDO' // CubicleStatus.BUSY + tiempo > umbral SLA (720 s)
  | 'LLAMANDO'     // CubicleStatus.CALLING
  | 'DISPONIBLE'   // CubicleStatus.AVAILABLE | RESERVED
  | 'INACTIVO';    // CubicleStatus.INACTIVE

// ─── Payload de cubículo en la telemetría ────────────────────────────────────
export interface TelemetryCubicleState {
  /** Código único del cubículo (ej: "CUB-01") */
  cubicleCode: string;
  /** Nombre para mostrar (ej: "Cubículo 01") */
  displayName: string;
  /** Código del módulo de atención (ej: "MOD-A") */
  moduleCode: string;
  /** Estado visual calculado por el servidor */
  visualStatus: AdminCubicleVisualStatus;
  /** Estado de dominio crudo */
  domainStatus: CubicleStatus;
  /** Código público del turno activo (sin PII) — null si no hay turno */
  activeTicketPublicCode: string | null;
  /** Nombre del operador asignado al cubículo — puede ser null si no hay usuario asignado */
  operatorDisplayName: string | null;
  /** ISO timestamp del momento en que el turno comenzó el servicio (IN_SERVICE) */
  serviceStartedAt: string | null;
  /** ISO timestamp del momento en que el cubículo quedó disponible (idle) */
  idleSinceAt: string | null;
  /** ISO timestamp del llamado (CALLING) */
  calledAt: string | null;
  /** Turnos completados por este cubículo en la jornada actual */
  dailyCompletedCount: number;
  /** Umbral SLA en segundos configurado en el backend */
  slaThresholdSeconds: number;
  /** Indica si el turno actual excede el umbral SLA */
  isSlaExceeded: boolean;
  /** Timestamp del cambio de estado (para cálculo de delta en cliente) */
  stateChangedAt: string;
}

// ─── Payload de turno en cola ─────────────────────────────────────────────────
export interface TelemetryQueuedTicket {
  position: number;
  ticketPublicCode: string;
  queueCategory: QueueCategory;
  /** ISO timestamp de creación del turno */
  issuedAtIso: string;
  /** Número formateado "HH:mm:ss" para visualización */
  issuedAtFormatted: string;
}

// ─── KPIs del día ─────────────────────────────────────────────────────────────
export interface TelemetryDailyKpis {
  /** Turnos en espera (PENDING) */
  waitingCount: number;
  /** Cubículos activos (AVAILABLE | RESERVED | CALLING | BUSY) */
  activeCubicles: number;
  /** Total de cubículos configurados */
  totalCubicles: number;
  /** Turnos finalizados hoy (CLOSED) */
  closedTodayCount: number;
  /** Porcentaje de cumplimiento SLA: turnos cerrados en ≤ slaThresholdSeconds */
  slaCompliancePercentage: number | null;
  /** Turnos no presentados hoy (NO_SHOW) */
  noShowTodayCount: number;
  /** Tasa de abandono en % */
  noShowRate: number | null;
  /** Tiempo de espera promedio (AWT) en segundos (created_at -> called_at) */
  averageWaitSeconds?: number | null;
  /** Tiempo medio de atención (TMM) en segundos (service_started_at -> closed_at) */
  averageServiceSeconds?: number | null;
}

// ─── Alerta de diagnóstico SLA ────────────────────────────────────────────────
export interface TelemetrySlaAlert {
  /** Hay desviación de SLA activa */
  isActive: boolean;
  /** Código del cubículo con mayor desviación */
  worstCubicleCode: string | null;
  /** Nombre del cubículo con mayor desviación */
  worstCubicleDisplay: string | null;
  /** Código del turno afectado */
  affectedTicketCode: string | null;
  /** Segundos acumulados del turno excedido */
  elapsedSeconds: number | null;
  /** Umbral SLA en segundos */
  thresholdSeconds: number;
  /** Porcentaje general de cumplimiento SLA */
  slaCompliancePercentage: number | null;
}

// ─── Flujo por hora ───────────────────────────────────────────────────────────
export interface TelemetryHourlyBucket {
  /** "HH:00" formateado con la zona horaria del servidor */
  hour: string;
  count: number;
}

// ─── Recomendación Prescriptiva de Cuello de Botella ────────────────────────
export interface BottleneckRecommendation {
  detected: boolean;
  congestedCategory: 'HIGH_COST' | 'PREFERENTIAL' | 'GENERAL' | 'BILLING';
  averageWaitSeconds: number;
  pendingCount: number;
  suggestedIdleCubicleCode?: string;
  suggestedAction?: string;
  message: string;
}

// ─── EVENTOS: Server → Client ─────────────────────────────────────────────────

/** Snapshot completo emitido al conectar o tras `telemetry:request-snapshot` */
export interface TelemetrySnapshotPayload {
  cubicles: TelemetryCubicleState[];
  queue: TelemetryQueuedTicket[];
  kpis: TelemetryDailyKpis;
  slaAlert: TelemetrySlaAlert;
  bottleneckRecommendation?: BottleneckRecommendation | null | undefined;
  hourlyFlow: TelemetryHourlyBucket[];
  serverTime: string;
}

/** Cambio de estado de un cubículo individual */
export interface CubicleStateChangedPayload {
  cubicle: TelemetryCubicleState;
  serverTime: string;
}

/** Actualización de la cola (nuevo turno, asignación, abandono) */
export interface QueueUpdatedPayload {
  queue: TelemetryQueuedTicket[];
  kpis: TelemetryDailyKpis;
  slaAlert: TelemetrySlaAlert;
  bottleneckRecommendation?: BottleneckRecommendation | null | undefined;
  serverTime: string;
}

/** Respuesta a ping — transporte de latencia RTT */
export interface TelemetryPongPayload {
  clientSentAt: number; // ms desde epoch — devuelto intacto
  serverTime: string;
}

// ─── EVENTOS: Client → Server ─────────────────────────────────────────────────

/** Solicitud manual de snapshot completo */
export interface TelemetryRequestSnapshotPayload {
  /* vacío intencionalmente */
}

/** Ping de latencia */
export interface TelemetryPingPayload {
  clientSentAt: number; // ms desde epoch
}

/** Aviso general hacia monitores de sala */
export interface AdminBroadcastNoticePayload {
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

// ─── Mapa de nombres de eventos (evita strings sueltos) ──────────────────────
export const TELEMETRY_EVENTS = {
  // S→C
  SNAPSHOT: 'telemetry:snapshot',
  CUBICLE_STATE_CHANGED: 'cubicle:state-changed',
  QUEUE_UPDATED: 'queue:updated',
  PONG: 'telemetry:pong',
  // C→S
  REQUEST_SNAPSHOT: 'telemetry:request-snapshot',
  PING: 'telemetry:ping',
  BROADCAST_NOTICE: 'admin:broadcast-notice',
} as const;

