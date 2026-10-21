export type TicketCategory = 'general' | 'preferencial' | 'especial' | 'triage';

export type TicketState = 'PENDING' | 'ASSIGNED' | 'CALLED';

export interface Ticket {
  id: string;
  code: string;
  category: TicketCategory;
  categoryLabel: string;
  createdAt: Date;
  cubicle?: string;
  module?: string;
  deskName?: string;
  calledAt?: number;
  patientName?: string;
  idDocument?: string;
  timeStr?: string;
  assignedCubicle?: string;
  state?: TicketState;
}

export type PharmacistPhase =
  | 'DISPONIBLE'
  | 'TURNO_ASIGNADO'
  | 'TURNO_LLAMADO'
  | 'EN_ATENCION'
  | 'DESPACHADO';

export interface CubicleInfo {
  id: string;
  name: string;
  module: string;
  deskName: string;
  pharmacistName: string;
}

export interface RecentCall {
  id: string;
  code: string;
  cubicle: string;
  timeAgo: string;
}
