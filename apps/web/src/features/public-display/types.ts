// ─── [SCR-PUB-001] Monitor Público de Llamado de Turnos — Tipos ──────────────

export type PublicCallPriority = 'GENERAL' | 'PREFERENCIAL';

export interface PublicTicketCall {
  id: string;
  ticketCode: string; // ej. 'TUR-000034-GE' o 'A-045'
  cubicleName: string; // ej. 'Cubículo 03'
  moduleCode?: string; // ej. 'MOD-B'
  priority: PublicCallPriority;
  calledAtIso: string;
  callCount?: number; // Incrementa cuando el operador o supervisor re-llama el turno
}

export interface PublicDisplayNotice {
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  issuedAtIso: string;
}

export interface PublicDisplayState {
  currentCall: PublicTicketCall | null;
  recentCalls: PublicTicketCall[]; // Máximo 4 ítems históricos
  connectionStatus: 'ONLINE' | 'RECONNECTING' | 'OFFLINE';
  soundEnabled: boolean;
  activeBroadcastNotice?: PublicDisplayNotice | null;
}

