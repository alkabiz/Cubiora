// ─── [SCR-PUB-001] Datos Semilla Iniciales de la Pantalla de Sala ────────────
import type { PublicTicketCall } from './types';

export const INITIAL_CURRENT_CALL: PublicTicketCall = {
  id: 'call_034',
  ticketCode: 'TUR-000034-GE',
  cubicleName: 'Cubículo 03',
  moduleCode: 'MOD-B',
  priority: 'GENERAL',
  calledAtIso: new Date().toISOString(),
  callCount: 1,
};

export const INITIAL_RECENT_CALLS: PublicTicketCall[] = [
  {
    id: 'call_033',
    ticketCode: 'TUR-000033-GE',
    cubicleName: 'Cubículo 03',
    moduleCode: 'MOD-B',
    priority: 'GENERAL',
    calledAtIso: new Date(Date.now() - 120000).toISOString(),
    callCount: 1,
  },
  {
    id: 'call_032',
    ticketCode: 'TUR-000032-GE',
    cubicleName: 'Cubículo 03',
    moduleCode: 'MOD-B',
    priority: 'GENERAL',
    calledAtIso: new Date(Date.now() - 300000).toISOString(),
    callCount: 1,
  },
  {
    id: 'call_031',
    ticketCode: 'TUR-000031-GE',
    cubicleName: 'Cubículo 03',
    moduleCode: 'MOD-B',
    priority: 'GENERAL',
    calledAtIso: new Date(Date.now() - 480000).toISOString(),
    callCount: 1,
  },
  {
    id: 'call_030',
    ticketCode: 'TUR-000030-GE',
    cubicleName: 'Cubículo 03',
    moduleCode: 'MOD-B',
    priority: 'GENERAL',
    calledAtIso: new Date(Date.now() - 660000).toISOString(),
    callCount: 1,
  },
];

