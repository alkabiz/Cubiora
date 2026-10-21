import type { CubicleActiveTicket, CubicleSnapshot } from '@cubiora/shared';

/**
 * Estados visuales de SCR-CAJ-001.
 *
 * Los estados PROCESSING_*, CONFIRM_*, CLOSED_* y NO_SHOW_NEXT existen
 * únicamente en el cliente. Nunca se envían ni se persisten en el backend:
 * son una representación de la operación en curso o del resultado confirmado
 * por la API.
 */
export type CubicleVisualStep =
  | 'INITIAL_LOADING'
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'PROCESSING_CALL'
  | 'CALLED'
  | 'PROCESSING_START'
  | 'IN_SERVICE'
  | 'CONFIRM_CLOSE'
  | 'PROCESSING_CLOSE'
  | 'CLOSED_NEXT'
  | 'CLOSED_NO_NEXT'
  | 'CONFIRM_NO_SHOW'
  | 'PROCESSING_NO_SHOW'
  | 'NO_SHOW_NEXT'
  | 'UNCERTAIN_RESULT'
  | 'OFFLINE'
  | 'RECONCILING';

export type CubicleCommand = 'call' | 'start-service' | 'close' | 'no-show';

/**
 * Resultado visual de un cierre o inasistencia confirmado por el servidor.
 * Se conserva únicamente en memoria para presentar el estado posterior.
 */
export interface CubicleOutcome {
  type: 'CLOSED' | 'NO_SHOW';
  finishedCode: string;
  hadNext: boolean;
}

export interface CubicleWorkspace {
  cubicleCode: string;
  displayName: string;
  cubicleNumber: string;
  snapshot: CubicleSnapshot | null;
  activeTicket: CubicleActiveTicket | null;
  step: CubicleVisualStep;
  pendingAction: CubicleCommand | null;
  outcome: CubicleOutcome | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isOnline: boolean;
  isReconciling: boolean;
  isUncertain: boolean;
  actionsDisabled: boolean;
  serverClockOffsetMs: number;
  waitingCount: number;
  actionError: string | null;
  syncError: string | null;
  requestCall: () => Promise<void>;
  requestStartService: () => Promise<void>;
  requestClose: () => void;
  cancelClose: () => void;
  confirmClose: () => Promise<void>;
  requestNoShow: () => void;
  cancelNoShow: () => void;
  confirmNoShow: () => Promise<void>;
  refresh: () => Promise<void>;
  reconcile: () => Promise<void>;
}

export interface UseCubicleWorkspaceOptions {
  cubicleCode: string;
  pollIntervalMs?: number;
}
