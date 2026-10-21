import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Ticket, TicketCategory, RecentCall, CubicleInfo } from '../types/queue';

interface QueueState {
  queue: Ticket[];
  currentCall: Ticket | null;
  recentCalls: RecentCall[];
  counter: number;
}

interface QueueContextValue extends QueueState {
  issueTicket: (category: TicketCategory, categoryLabel: string, letter: string) => Ticket;
  callNextTicket: (cubicleInfo: CubicleInfo) => Ticket | null;
  recallCurrentTicket: () => void;
  startAttention: (ticketId: string) => void;
  dispatchCurrentTicket: (ticketId: string) => void;
}

const STORAGE_KEY = 'cubiora_dispensacion_state_v1';
const CHANNEL_NAME = 'cubiora_dispensacion_sync';

const PRIORITY_WEIGHT: Record<TicketCategory, number> = {
  triage: 1,
  preferencial: 2,
  especial: 3,
  general: 4,
};

const INITIAL_STATE: QueueState = {
  queue: [
    {
      id: 'seed-1',
      code: 'TUR-000311-P6',
      category: 'preferencial',
      categoryLabel: 'Prioritaria',
      createdAt: new Date(),
    },
    {
      id: 'seed-2',
      code: 'TUR-000312-A6',
      category: 'general',
      categoryLabel: 'General',
      createdAt: new Date(),
    },
  ],
  currentCall: {
    id: 'c-1',
    code: 'TUR-000125-P5',
    category: 'preferencial',
    categoryLabel: 'Prioritaria',
    createdAt: new Date(),
    cubicle: 'CUBÍCULO 04',
    module: 'Módulo A4',
    deskName: 'Ventanilla 4',
    calledAt: Date.now(),
  },
  recentCalls: [
    { id: 'r1', code: 'TUR-000122-F4', cubicle: 'CUBÍCULO 01', timeAgo: 'Hace 3 min' },
    { id: 'r2', code: 'TUR-000119-L8', cubicle: 'CUBÍCULO 02', timeAgo: 'Hace 7 min' },
    { id: 'r3', code: 'TUR-000118-K1', cubicle: 'CUBÍCULO 04', timeAgo: 'Hace 12 min' },
  ],
  counter: 312,
};

const QueueContext = createContext<QueueContextValue | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<QueueState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return INITIAL_STATE;
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        queue: parsed.queue.map((t: Ticket) => ({ ...t, createdAt: new Date(t.createdAt) })),
        currentCall: parsed.currentCall
          ? { ...parsed.currentCall, createdAt: new Date(parsed.currentCall.createdAt) }
          : null,
      };
    } catch {
      return INITIAL_STATE;
    }
  });

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event: MessageEvent<QueueState>) => {
      if (event.data) {
        setState(event.data);
      }
    };

    return () => channel.close();
  }, []);

  const commitState = useCallback((updater: (prev: QueueState) => QueueState) => {
    setState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel(CHANNEL_NAME);
          channel.postMessage(next);
          channel.close();
        }
      } catch (error) {
        console.error('Error sincronizando estado de Cubiora:', error);
      }
      return next;
    });
  }, []);

  const issueTicket = useCallback(
    (category: TicketCategory, categoryLabel: string, letter: string): Ticket => {
      let createdTicket!: Ticket;

      commitState((prev) => {
        const nextNum = prev.counter + 1;
        const paddedNum = String(nextNum).padStart(6, '0');
        createdTicket = {
          id: `kio-${Date.now()}`,
          code: `TUR-${paddedNum}-${letter}6`,
          category,
          categoryLabel,
          createdAt: new Date(),
        };

        const updatedQueue = [...prev.queue, createdTicket].sort(
          (a, b) => PRIORITY_WEIGHT[a.category] - PRIORITY_WEIGHT[b.category]
        );

        return {
          ...prev,
          counter: nextNum,
          queue: updatedQueue,
        };
      });

      return createdTicket;
    },
    [commitState]
  );

  const callNextTicket = useCallback(
    (cubicleInfo: CubicleInfo): Ticket | null => {
      let calledTicket: Ticket | null = null;

      commitState((prev) => {
        if (prev.queue.length === 0) return prev;

        const [next, ...remainingQueue] = prev.queue;
        calledTicket = {
          ...next,
          cubicle: cubicleInfo.name,
          module: cubicleInfo.module,
          deskName: cubicleInfo.deskName,
          calledAt: Date.now(),
        };

        const updatedHistory: RecentCall[] = prev.currentCall
          ? [
              {
                id: prev.currentCall.id,
                code: prev.currentCall.code,
                cubicle: prev.currentCall.cubicle || cubicleInfo.name,
                timeAgo: 'Hace instantes',
              },
              ...prev.recentCalls.slice(0, 2),
            ]
          : prev.recentCalls;

        return {
          ...prev,
          queue: remainingQueue,
          currentCall: calledTicket,
          recentCalls: updatedHistory,
        };
      });

      return calledTicket;
    },
    [commitState]
  );

  const recallCurrentTicket = useCallback(() => {
    commitState((prev) => {
      if (!prev.currentCall) return prev;
      return {
        ...prev,
        currentCall: {
          ...prev.currentCall,
          calledAt: Date.now(),
        },
      };
    });
  }, [commitState]);

  const startAttention = useCallback((_ticketId: string) => {}, []);

  const dispatchCurrentTicket = useCallback(
    (ticketId: string) => {
      commitState((prev) => {
        if (prev.currentCall?.id !== ticketId) return prev;
        return {
          ...prev,
          recentCalls: [
            {
              id: prev.currentCall.id,
              code: prev.currentCall.code,
              cubicle: prev.currentCall.cubicle || 'CUBÍCULO 04',
              timeAgo: 'Atendido',
            },
            ...prev.recentCalls.filter((r) => r.id !== prev.currentCall?.id).slice(0, 2),
          ],
        };
      });
    },
    [commitState]
  );

  return (
    <QueueContext.Provider
      value={{
        ...state,
        issueTicket,
        callNextTicket,
        recallCurrentTicket,
        startAttention,
        dispatchCurrentTicket,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = (): QueueContextValue => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue debe ser utilizado dentro de un QueueProvider');
  }
  return context;
};
