export type PriorityLevel = 'general' | 'preferencial' | 'especial' | 'urgente';

export type TicketStatus = 'waiting' | 'calling' | 'in_service' | 'completed' | 'abandoned';

export type CubicleStatus = 'available' | 'calling' | 'busy' | 'exceeded' | 'inactive';

export interface Ticket {
  id: string; // e.g. TUR-000120-B9
  number: number;
  priority: PriorityLevel;
  issuedAt: Date;
  calledAt?: Date;
  serviceStartedAt?: Date;
  completedAt?: Date;
  assignedCubicleId?: string;
  assignedOperator?: string;
  status: TicketStatus;
  callCount: number;
}

export interface Cubicle {
  id: string; // "01", "02", "03", "04", "05"
  name: string; // "Cubículo 01"
  moduleType: string; // "MOD-A", "MOD-B"
  operator: string; // "Lic. M. Arismendi"
  operatorRole?: string;
  status: CubicleStatus;
  currentTicketId?: string;
  sessionElapsedSeconds: number;
  lastCompletedElapsedSeconds?: number;
  assignedTicketsCountToday: number;
  slaExceededThresholdSeconds: number; // default 720 (12 min)
}

export interface AttendedRecord {
  id: string;
  ticketId: string;
  cubicleName: string;
  operator: string;
  priority: PriorityLevel;
  issuedAt: Date;
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  slaCompliant: boolean;
  status: 'completed' | 'abandoned';
}

export interface HourlyLoad {
  hour: string;
  count: number;
  percentage: number;
  isPeak?: boolean;
}
