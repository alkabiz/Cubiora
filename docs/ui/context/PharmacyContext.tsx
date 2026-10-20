import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Ticket,
  Cubicle,
  AttendedRecord,
  PriorityLevel,
  HourlyLoad,
} from '../types/pharmacy';
import { playHospitalChime, announceTicketVoice } from '../utils/audio';

export type ScreenView = 'admin' | 'reception' | 'cubicle' | 'public' | 'cubicles_config' | 'history';

interface PharmacyContextType {
  currentView: ScreenView;
  setCurrentView: (view: ScreenView) => void;
  cubicles: Cubicle[];
  waitingQueue: Ticket[];
  callingTickets: Ticket[];
  activeTicketsMap: Record<string, Ticket>;
  historyRecords: AttendedRecord[];
  hourlyLoads: HourlyLoad[];
  selectedCubicleId: string;
  setSelectedCubicleId: (id: string) => void;
  urgentAlertVisible: boolean;
  dismissUrgentAlert: () => void;
  broadcastAlertText: string | null;
  broadcastModalOpen: boolean;
  setBroadcastModalOpen: (open: boolean) => void;
  sendBroadcastAlert: (message: string) => void;
  clearBroadcastAlert: () => void;
  isLiveSync: boolean;
  toggleLiveSync: () => void;
  currentTimeString: string;
  createTicket: (priority: PriorityLevel) => Ticket;
  callNextInQueue: (cubicleId: string) => void;
  callSpecificTicket: (cubicleId: string, ticketId: string) => void;
  repeatCall: (cubicleId: string) => void;
  startServiceForCubicle: (cubicleId: string) => void;
  completeServiceForCubicle: (cubicleId: string) => void;
  markTicketAbandoned: (cubicleId: string) => void;
  activateCubicle: (cubicleId: string) => void;
  deactivateCubicle: (cubicleId: string) => void;
  audioEnabled: boolean;
  setAudioEnabled: (val: boolean) => void;
  triggerChime: () => void;
  // Operational Metrics
  metrics: {
    waitingCount: number;
    avgWaitMinutes: number;
    occupancyPct: number;
    activeCount: number;
    totalCount: number;
    completedToday: number;
    slaCompliancePct: number;
    abandonedCount: number;
    abandonmentRatePct: number;
    isOperationHealthy: boolean;
    operationalStatusSummary: string;
  };
}

const initialTickets: Ticket[] = [
  {
    id: 'TUR-000120-B9',
    number: 120,
    priority: 'general',
    issuedAt: new Date(Date.now() - 25 * 60 * 1000),
    serviceStartedAt: new Date(Date.now() - 12 * 60 * 1000 - 45 * 1000),
    status: 'in_service',
    assignedCubicleId: '02',
    assignedOperator: 'Farm. J. Duarte',
    callCount: 1,
  },
  {
    id: 'TUR-000122-F4',
    number: 122,
    priority: 'general',
    issuedAt: new Date(Date.now() - 15 * 60 * 1000),
    serviceStartedAt: new Date(Date.now() - 5 * 60 * 1000 - 20 * 1000),
    status: 'in_service',
    assignedCubicleId: '01',
    assignedOperator: 'Lic. M. Arismendi',
    callCount: 1,
  },
  {
    id: 'TUR-000123-A7',
    number: 123,
    priority: 'preferencial',
    issuedAt: new Date(Date.now() - 10 * 60 * 1000),
    calledAt: new Date(Date.now() - 45 * 1000),
    status: 'calling',
    assignedCubicleId: '03',
    assignedOperator: 'Lic. R. Mendoza',
    callCount: 2,
  },
  {
    id: 'TUR-000124-K3',
    number: 124,
    priority: 'preferencial',
    issuedAt: new Date(Date.now() - 8 * 60 * 1000 - 5 * 1000),
    status: 'waiting',
    callCount: 0,
  },
  {
    id: 'TUR-000125-P8',
    number: 125,
    priority: 'general',
    issuedAt: new Date(Date.now() - 5 * 60 * 1000 - 53 * 1000),
    status: 'waiting',
    callCount: 0,
  },
  {
    id: 'TUR-000126-M2',
    number: 126,
    priority: 'general',
    issuedAt: new Date(Date.now() - 3 * 60 * 1000 - 35 * 1000),
    status: 'waiting',
    callCount: 0,
  },
  {
    id: 'TUR-000127-R1',
    number: 127,
    priority: 'general',
    issuedAt: new Date(Date.now() - 2 * 60 * 1000 - 13 * 1000),
    status: 'waiting',
    callCount: 0,
  },
];

const initialCubicles: Cubicle[] = [
  {
    id: '01',
    name: 'Cubículo 01',
    moduleType: 'MOD-A',
    operator: 'Lic. M. Arismendi',
    operatorRole: 'Farmacéutico Titular',
    status: 'busy',
    currentTicketId: 'TUR-000122-F4',
    sessionElapsedSeconds: 320, // 05:20
    assignedTicketsCountToday: 38,
    slaExceededThresholdSeconds: 720,
  },
  {
    id: '02',
    name: 'Cubículo 02',
    moduleType: 'MOD-A',
    operator: 'Farm. J. Duarte',
    operatorRole: 'Farmacéutico Adjunto',
    status: 'exceeded',
    currentTicketId: 'TUR-000120-B9',
    sessionElapsedSeconds: 765, // 12:45
    assignedTicketsCountToday: 34,
    slaExceededThresholdSeconds: 720,
  },
  {
    id: '03',
    name: 'Cubículo 03',
    moduleType: 'MOD-B',
    operator: 'Lic. R. Mendoza',
    operatorRole: 'Farmacéutico Reg. 4812',
    status: 'calling',
    currentTicketId: 'TUR-000123-A7',
    sessionElapsedSeconds: 45, // 00:45
    assignedTicketsCountToday: 41,
    slaExceededThresholdSeconds: 720,
  },
  {
    id: '04',
    name: 'Cubículo 04',
    moduleType: 'MOD-B',
    operator: 'Farm. S. Quintero',
    operatorRole: 'Técnico Dispensador',
    status: 'available',
    sessionElapsedSeconds: 0,
    lastCompletedElapsedSeconds: 75, // 1m 15s
    assignedTicketsCountToday: 35,
    slaExceededThresholdSeconds: 720,
  },
  {
    id: '05',
    name: 'Cubículo 05',
    moduleType: 'MOD-C',
    operator: 'Sin operador asignado',
    operatorRole: 'Fuera de Servicio',
    status: 'inactive',
    sessionElapsedSeconds: 0,
    assignedTicketsCountToday: 0,
    slaExceededThresholdSeconds: 720,
  },
];

const initialHistory: AttendedRecord[] = [
  {
    id: 'rec-1',
    ticketId: 'TUR-000119-L2',
    cubicleName: 'Cubículo 04',
    operator: 'Farm. S. Quintero',
    priority: 'general',
    issuedAt: new Date(Date.now() - 35 * 60 * 1000),
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
    completedAt: new Date(Date.now() - 1 * 60 * 1000 - 15 * 1000),
    durationSeconds: 412,
    slaCompliant: true,
    status: 'completed',
  },
  {
    id: 'rec-2',
    ticketId: 'TUR-000118-H1',
    cubicleName: 'Cubículo 03',
    operator: 'Lic. R. Mendoza',
    priority: 'preferencial',
    issuedAt: new Date(Date.now() - 40 * 60 * 1000),
    startedAt: new Date(Date.now() - 16 * 60 * 1000),
    completedAt: new Date(Date.now() - 9 * 60 * 1000),
    durationSeconds: 420,
    slaCompliant: true,
    status: 'completed',
  },
  {
    id: 'rec-3',
    ticketId: 'TUR-000117-K9',
    cubicleName: 'Cubículo 01',
    operator: 'Lic. M. Arismendi',
    priority: 'general',
    issuedAt: new Date(Date.now() - 55 * 60 * 1000),
    startedAt: new Date(Date.now() - 25 * 60 * 1000),
    completedAt: new Date(Date.now() - 18 * 60 * 1000),
    durationSeconds: 420,
    slaCompliant: true,
    status: 'completed',
  },
  {
    id: 'rec-4',
    ticketId: 'TUR-000116-X3',
    cubicleName: 'Cubículo 02',
    operator: 'Farm. J. Duarte',
    priority: 'general',
    issuedAt: new Date(Date.now() - 65 * 60 * 1000),
    startedAt: new Date(Date.now() - 32 * 60 * 1000),
    completedAt: new Date(Date.now() - 30 * 60 * 1000),
    durationSeconds: 120,
    slaCompliant: true,
    status: 'abandoned',
  },
];

const initialHourlyLoad: HourlyLoad[] = [
  { hour: '07:00', count: 18, percentage: 35 },
  { hour: '08:00', count: 32, percentage: 60 },
  { hour: '09:00', count: 54, percentage: 95, isPeak: true },
  { hour: '10:00', count: 26, percentage: 45 },
  { hour: '11:00', count: 6, percentage: 10 },
];

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

export const PharmacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ScreenView>('admin');
  const [cubicles, setCubicles] = useState<Cubicle[]>(initialCubicles);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [historyRecords, setHistoryRecords] = useState<AttendedRecord[]>(initialHistory);
  const [hourlyLoads] = useState<HourlyLoad[]>(initialHourlyLoad);
  const [selectedCubicleId, setSelectedCubicleId] = useState<string>('03');
  const [urgentAlertVisible, setUrgentAlertVisible] = useState<boolean>(true);
  const [broadcastAlertText, setBroadcastAlertText] = useState<string | null>(null);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState<boolean>(false);
  const [isLiveSync, setIsLiveSync] = useState<boolean>(true);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Real-time clock and timer ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());

      if (!isLiveSync) return;

      setCubicles((prevCubicles) =>
        prevCubicles.map((c) => {
          if (c.status === 'busy' || c.status === 'calling' || c.status === 'exceeded') {
            const newElapsed = c.sessionElapsedSeconds + 1;
            let newStatus = c.status;
            if (c.status === 'busy' && newElapsed >= c.slaExceededThresholdSeconds) {
              newStatus = 'exceeded';
            }
            return {
              ...c,
              sessionElapsedSeconds: newElapsed,
              status: newStatus,
            };
          }
          if (c.status === 'available') {
            return {
              ...c,
              lastCompletedElapsedSeconds: (c.lastCompletedElapsedSeconds || 0) + 1,
            };
          }
          return c;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [isLiveSync]);

  const toggleLiveSync = () => {
    setIsLiveSync((prev) => !prev);
  };

  const dismissUrgentAlert = () => {
    setUrgentAlertVisible(false);
  };

  const sendBroadcastAlert = (msg: string) => {
    setBroadcastAlertText(msg);
    if (audioEnabled) {
      playHospitalChime();
    }
  };

  const clearBroadcastAlert = () => {
    setBroadcastAlertText(null);
  };

  const triggerChime = () => {
    playHospitalChime();
  };

  // Waiting queue (status = 'waiting')
  const waitingQueue = tickets.filter((t) => t.status === 'waiting');

  // Calling tickets
  const callingTickets = tickets.filter((t) => t.status === 'calling');

  // Map of tickets by ID for quick lookup
  const activeTicketsMap: Record<string, Ticket> = tickets.reduce((acc, t) => {
    acc[t.id] = t;
    return acc;
  }, {} as Record<string, Ticket>);

  // Compute metrics
  const activeCount = cubicles.filter((c) => c.status !== 'inactive').length;
  const busyCount = cubicles.filter(
    (c) => c.status === 'busy' || c.status === 'exceeded' || c.status === 'calling'
  ).length;
  const occupancyPct = activeCount > 0 ? Math.round((busyCount / activeCount) * 100) : 0;
  const completedToday = 148 + historyRecords.length - 4;
  const abandonedCount = 2 + historyRecords.filter((h) => h.status === 'abandoned').length - 1;

  const hasExceededCubicles = cubicles.some((c) => c.status === 'exceeded');
  const isOperationHealthy = !hasExceededCubicles && waitingQueue.length <= 8;
  const operationalStatusSummary = hasExceededCubicles
    ? 'Atención Requerida: Umbral de SLA superado en puesto de atención'
    : waitingQueue.length > 8
    ? 'Carga Alta: Tiempo de espera en sala por encima del objetivo'
    : 'Operación Nominal: Flujo de atención dentro de los parámetros esperados';

  const metrics = {
    waitingCount: waitingQueue.length,
    avgWaitMinutes: 6,
    occupancyPct: occupancyPct,
    activeCount: busyCount,
    totalCount: activeCount,
    completedToday: completedToday,
    slaCompliancePct: 98.2,
    abandonedCount: abandonedCount,
    abandonmentRatePct: 1.33,
    isOperationHealthy,
    operationalStatusSummary,
  };

  // Create ticket (operational only)
  const createTicket = (priority: PriorityLevel): Ticket => {
    const nextNum = 120 + tickets.length + 1;
    let prefix = 'TUR';
    if (priority === 'preferencial') prefix = 'PRE';
    if (priority === 'especial') prefix = 'ESP';
    if (priority === 'urgente') prefix = 'URG';

    const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
    const formattedId = `${prefix}-000${nextNum}-${suffix}`;

    const newTicket: Ticket = {
      id: formattedId,
      number: nextNum,
      priority,
      issuedAt: new Date(),
      status: 'waiting',
      callCount: 0,
    };

    setTickets((prev) => [...prev, newTicket]);
    return newTicket;
  };

  // Call next in queue
  const callNextInQueue = (cubicleId: string) => {
    const targetCubicle = cubicles.find((c) => c.id === cubicleId);
    if (!targetCubicle) return;

    if (waitingQueue.length === 0) return;

    const nextTicket = waitingQueue[0];
    callSpecificTicket(cubicleId, nextTicket.id);
  };

  // Call specific ticket
  const callSpecificTicket = (cubicleId: string, ticketId: string) => {
    const targetCubicle = cubicles.find((c) => c.id === cubicleId);
    if (!targetCubicle) return;

    const ticketToCall = tickets.find((t) => t.id === ticketId);
    if (!ticketToCall) return;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'calling',
            calledAt: new Date(),
            assignedCubicleId: cubicleId,
            assignedOperator: targetCubicle.operator,
            callCount: t.callCount + 1,
          };
        }
        return t;
      })
    );

    setCubicles((prev) =>
      prev.map((c) => {
        if (c.id === cubicleId) {
          return {
            ...c,
            status: 'calling',
            currentTicketId: ticketId,
            sessionElapsedSeconds: 0,
            assignedTicketsCountToday: c.assignedTicketsCountToday + 1,
          };
        }
        return c;
      })
    );

    if (audioEnabled) {
      playHospitalChime();
      announceTicketVoice(ticketId, targetCubicle.name);
    }
  };

  // Repeat call for ticket currently calling
  const repeatCall = (cubicleId: string) => {
    const targetCubicle = cubicles.find((c) => c.id === cubicleId);
    if (!targetCubicle || !targetCubicle.currentTicketId) return;

    const ticketId = targetCubicle.currentTicketId;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            callCount: t.callCount + 1,
            calledAt: new Date(),
          };
        }
        return t;
      })
    );

    if (audioEnabled) {
      playHospitalChime();
      announceTicketVoice(ticketId, targetCubicle.name);
    }
  };

  // Start service for cubicle
  const startServiceForCubicle = (cubicleId: string) => {
    const targetCubicle = cubicles.find((c) => c.id === cubicleId);
    if (!targetCubicle || !targetCubicle.currentTicketId) return;

    const ticketId = targetCubicle.currentTicketId;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'in_service',
            serviceStartedAt: new Date(),
          };
        }
        return t;
      })
    );

    setCubicles((prev) =>
      prev.map((c) => {
        if (c.id === cubicleId) {
          return {
            ...c,
            status: 'busy',
          };
        }
        return c;
      })
    );
  };

  // Complete ticket service
  const completeServiceForCubicle = (cubicleId: string) => {
    const targetCubicle = cubicles.find((c) => c.id === cubicleId);
    if (!targetCubicle || !targetCubicle.currentTicketId) return;

    const ticketId = targetCubicle.currentTicketId;
    const ticket = tickets.find((t) => t.id === ticketId);
    const now = new Date();

    if (ticket) {
      const durationSeconds = targetCubicle.sessionElapsedSeconds;
      const slaCompliant = durationSeconds < targetCubicle.slaExceededThresholdSeconds;

      const record: AttendedRecord = {
        id: `rec-${Date.now()}`,
        ticketId: ticket.id,
        cubicleName: targetCubicle.name,
        operator: targetCubicle.operator,
        priority: ticket.priority,
        issuedAt: ticket.issuedAt,
        startedAt: ticket.serviceStartedAt || ticket.calledAt || now,
        completedAt: now,
        durationSeconds,
        slaCompliant,
        status: 'completed',
      };

      setHistoryRecords((prev) => [record, ...prev]);

      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketId) {
            return {
              ...t,
              status: 'completed',
              completedAt: now,
            };
          }
          return t;
        })
      );
    }

    setCubicles((prev) =>
      prev.map((c) => {
        if (c.id === cubicleId) {
          return {
            ...c,
            status: 'available',
            currentTicketId: undefined,
            sessionElapsedSeconds: 0,
            lastCompletedElapsedSeconds: 0,
          };
        }
        return c;
      })
    );
  };

  // Mark abandoned / no-show
  const markTicketAbandoned = (cubicleId: string) => {
    const targetCubicle = cubicles.find((c) => c.id === cubicleId);
    if (!targetCubicle || !targetCubicle.currentTicketId) return;

    const ticketId = targetCubicle.currentTicketId;
    const ticket = tickets.find((t) => t.id === ticketId);
    const now = new Date();

    if (ticket) {
      const record: AttendedRecord = {
        id: `rec-${Date.now()}`,
        ticketId: ticket.id,
        cubicleName: targetCubicle.name,
        operator: targetCubicle.operator,
        priority: ticket.priority,
        issuedAt: ticket.issuedAt,
        startedAt: ticket.calledAt || now,
        completedAt: now,
        durationSeconds: targetCubicle.sessionElapsedSeconds,
        slaCompliant: true,
        status: 'abandoned',
      };
      setHistoryRecords((prev) => [record, ...prev]);

      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketId) {
            return {
              ...t,
              status: 'abandoned',
              completedAt: now,
            };
          }
          return t;
        })
      );
    }

    setCubicles((prev) =>
      prev.map((c) => {
        if (c.id === cubicleId) {
          return {
            ...c,
            status: 'available',
            currentTicketId: undefined,
            sessionElapsedSeconds: 0,
            lastCompletedElapsedSeconds: 0,
          };
        }
        return c;
      })
    );
  };

  // Activate cubicle
  const activateCubicle = (cubicleId: string) => {
    setCubicles((prev) =>
      prev.map((c) => {
        if (c.id === cubicleId) {
          return {
            ...c,
            status: 'available',
            operator: c.operator === 'Sin operador asignado' ? 'Personal Disponible' : c.operator,
            sessionElapsedSeconds: 0,
            lastCompletedElapsedSeconds: 0,
          };
        }
        return c;
      })
    );
  };

  // Deactivate cubicle
  const deactivateCubicle = (cubicleId: string) => {
    setCubicles((prev) =>
      prev.map((c) => {
        if (c.id === cubicleId) {
          return {
            ...c,
            status: 'inactive',
            currentTicketId: undefined,
            sessionElapsedSeconds: 0,
          };
        }
        return c;
      })
    );
  };

  const currentTimeString = currentTime.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <PharmacyContext.Provider
      value={{
        currentView,
        setCurrentView,
        cubicles,
        waitingQueue,
        callingTickets,
        activeTicketsMap,
        historyRecords,
        hourlyLoads,
        selectedCubicleId,
        setSelectedCubicleId,
        urgentAlertVisible,
        dismissUrgentAlert,
        broadcastAlertText,
        broadcastModalOpen,
        setBroadcastModalOpen,
        sendBroadcastAlert,
        clearBroadcastAlert,
        isLiveSync,
        toggleLiveSync,
        currentTimeString,
        createTicket,
        callNextInQueue,
        callSpecificTicket,
        repeatCall,
        startServiceForCubicle,
        completeServiceForCubicle,
        markTicketAbandoned,
        activateCubicle,
        deactivateCubicle,
        audioEnabled,
        setAudioEnabled,
        triggerChime,
        metrics,
      }}
    >
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
};
