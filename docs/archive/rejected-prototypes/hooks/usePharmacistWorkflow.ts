import { useReducer, useEffect, useCallback } from 'react';
import { Ticket, PharmacistPhase } from '../types/queue';

interface WorkflowState {
  phase: PharmacistPhase;
  currentTicket: Ticket | null;
}

type WorkflowAction =
  | { type: 'CALL_TICKET'; ticket: Ticket }
  | { type: 'START_ATTENTION' }
  | { type: 'DISPATCH_TICKET' }
  | { type: 'RESET_TO_AVAILABLE' };

function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'CALL_TICKET':
      if (state.phase !== 'DISPONIBLE') return state;
      return { phase: 'TURNO_LLAMADO', currentTicket: action.ticket };

    case 'START_ATTENTION':
      if (state.phase !== 'TURNO_LLAMADO' || !state.currentTicket) return state;
      return { ...state, phase: 'EN_ATENCION' };

    case 'DISPATCH_TICKET':
      if (state.phase !== 'EN_ATENCION') return state;
      return { ...state, phase: 'DESPACHADO' };

    case 'RESET_TO_AVAILABLE':
      return { phase: 'DISPONIBLE', currentTicket: null };

    default:
      return state;
  }
}

export function usePharmacistWorkflow(onCompleteDispatch?: (ticket: Ticket) => void) {
  const [state, dispatch] = useReducer(workflowReducer, {
    phase: 'DISPONIBLE',
    currentTicket: null,
  });

  useEffect(() => {
    if (state.phase !== 'DESPACHADO') return;
    const timerId = window.setTimeout(() => {
      if (state.currentTicket) onCompleteDispatch?.(state.currentTicket);
      dispatch({ type: 'RESET_TO_AVAILABLE' });
    }, 1200);

    return () => window.clearTimeout(timerId);
  }, [state.phase, state.currentTicket, onCompleteDispatch]);

  const callTicket = useCallback((ticket: Ticket) => {
    dispatch({ type: 'CALL_TICKET', ticket });
  }, []);

  const startAttention = useCallback(() => {
    dispatch({ type: 'START_ATTENTION' });
  }, []);

  const dispatchTicket = useCallback(() => {
    dispatch({ type: 'DISPATCH_TICKET' });
  }, []);

  return {
    phase: state.phase,
    currentTicket: state.currentTicket,
    callTicket,
    startAttention,
    dispatchTicket,
  };
}
