// ─── SCR-ADM-001 · Hook de telemetría operativa bidireccional en tiempo real ──
import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  TELEMETRY_EVENTS,
  type TelemetrySnapshotPayload,
  type CubicleStateChangedPayload,
  type QueueUpdatedPayload,
  type TelemetryPongPayload,
  type TelemetryCubicleState,
  type TelemetryQueuedTicket,
  type TelemetryDailyKpis,
  type TelemetrySlaAlert,
} from '@cubiora/shared';
import type {
  CubicleStation,
  QueuedTicket,
  HourlyFlowEntry,
  ConnectionStatus,
  OperationalTelemetryHookResult,
  CubicleStatus,
} from './types';

/** Formatea segundos a formato "MM:ss min" */
export function formatElapsedTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
}

/** Formatea tiempo de ocio para puestos DISPONIBLE */
export function formatIdleTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `Ocio: hace ${m}m ${String(s).padStart(2, '0')}s`;
}

/** Formatea tiempo de espera para la cola */
export function formatWaitTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
}

// ─── Estado inicial mockeado (Fallback de alta fidelidad) ──────────────────────
const FALLBACK_CUBICLES: CubicleStation[] = [
  {
    id: 'CUB-01',
    name: 'Cubículo 01',
    moduleCode: 'MOD-A',
    status: 'ATENDIENDO',
    assignedTicket: 'TUR-000122-F4',
    operatorName: 'Lic. M. Arismendi',
    elapsedSeconds: 432, // 07:12 min
    elapsedTimeFormatted: '07:12 min',
    statusFooterText: 'En rango de SLA nominal',
    dailyProcessedCount: 38,
    slaThresholdSeconds: 720,
    startedAtIso: new Date(Date.now() - 432 * 1000).toISOString(),
  },
  {
    id: 'CUB-02',
    name: 'Cubículo 02',
    moduleCode: 'MOD-A',
    status: 'SLA_EXCEDIDO',
    assignedTicket: 'TUR-000120-B9',
    operatorName: 'Farm. J. Duarte',
    elapsedSeconds: 877, // 14:37 min
    elapsedTimeFormatted: '14:37 min',
    statusFooterText: 'Umbral superado (>12 min)',
    dailyProcessedCount: 34,
    slaThresholdSeconds: 720,
    startedAtIso: new Date(Date.now() - 877 * 1000).toISOString(),
  },
  {
    id: 'CUB-03',
    name: 'Cubículo 03',
    moduleCode: 'MOD-B',
    status: 'LLAMANDO',
    assignedTicket: 'TUR-000123-A7',
    operatorName: 'Lic. R. Mendoza',
    elapsedSeconds: 157, // 02:37 min
    elapsedTimeFormatted: '02:37 min',
    statusFooterText: 'Proyectado en monitor',
    dailyProcessedCount: 41,
    calledAtIso: new Date(Date.now() - 157 * 1000).toISOString(),
  },
  {
    id: 'CUB-04',
    name: 'Cubículo 04',
    moduleCode: 'MOD-B',
    status: 'DISPONIBLE',
    assignedTicket: null,
    operatorName: 'Farm. S. Quintero',
    elapsedSeconds: 187, // 3m 7s
    elapsedTimeFormatted: 'Ocio: hace 3m 7s',
    statusFooterText: 'Estación lista para asignación',
    dailyProcessedCount: 35,
    idleSinceIso: new Date(Date.now() - 187 * 1000).toISOString(),
  },
  {
    id: 'CUB-05',
    name: 'Cubículo 05',
    moduleCode: 'MOD-C',
    status: 'INACTIVO',
    assignedTicket: null,
    operatorName: null,
    elapsedSeconds: 0,
    elapsedTimeFormatted: 'Fuera de servicio',
    statusFooterText: 'Puesto en mantenimiento programado',
    dailyProcessedCount: 0,
    fullWidth: true,
  },
];

const FALLBACK_QUEUE: QueuedTicket[] = [
  {
    position: 1,
    ticketCode: 'TUR-000124-K3',
    priority: 'PREFERENCIAL',
    issuedAt: '14:03:18',
    waitingSeconds: 597, // 09:57 min
    issuedAtIso: new Date(Date.now() - 597 * 1000).toISOString(),
  },
  {
    position: 2,
    ticketCode: 'TUR-000125-P8',
    priority: 'GENERAL',
    issuedAt: '14:05:30',
    waitingSeconds: 465, // 07:45 min
    issuedAtIso: new Date(Date.now() - 465 * 1000).toISOString(),
  },
  {
    position: 3,
    ticketCode: 'TUR-000126-M2',
    priority: 'GENERAL',
    issuedAt: '14:07:48',
    waitingSeconds: 327, // 05:27 min
    issuedAtIso: new Date(Date.now() - 327 * 1000).toISOString(),
  },
  {
    position: 4,
    ticketCode: 'TUR-000127-R1',
    priority: 'GENERAL',
    issuedAt: '14:09:10',
    waitingSeconds: 245, // 04:05 min
    issuedAtIso: new Date(Date.now() - 245 * 1000).toISOString(),
  },
];

const FALLBACK_KPIS: TelemetryDailyKpis = {
  waitingCount: 4,
  activeCubicles: 3,
  totalCubicles: 4,
  closedTodayCount: 148,
  slaCompliancePercentage: 98.2,
  noShowTodayCount: 2,
  noShowRate: 1.33,
};

const FALLBACK_SLA_ALERT: TelemetrySlaAlert = {
  isActive: true,
  worstCubicleCode: 'CUB-02',
  worstCubicleDisplay: 'Cubículo 02',
  affectedTicketCode: 'TUR-000120-B9',
  elapsedSeconds: 859, // 14:19 min
  thresholdSeconds: 720,
  slaCompliancePercentage: 98.2,
};

const FALLBACK_HOURLY_FLOW: HourlyFlowEntry[] = [
  { hour: '07:00', volume: 28 },
  { hour: '08:00', volume: 56 },
  { hour: '09:00', volume: 72, isCurrentHour: true },
  { hour: '10:00', volume: 44 },
  { hour: '11:00', volume: 20 },
];

// ─── Helpers de conversión Server → Client ───────────────────────────────────

function mapServerCubicle(serverCub: TelemetryCubicleState): CubicleStation {
  let statusFooterText = 'Estación lista para asignación';
  if (serverCub.visualStatus === 'ATENDIENDO') {
    statusFooterText = 'En rango de SLA nominal';
  } else if (serverCub.visualStatus === 'SLA_EXCEDIDO') {
    statusFooterText = `Umbral superado (>${Math.round(serverCub.slaThresholdSeconds / 60)} min)`;
  } else if (serverCub.visualStatus === 'LLAMANDO') {
    statusFooterText = 'Proyectado en monitor';
  } else if (serverCub.visualStatus === 'INACTIVO') {
    statusFooterText = 'Puesto en mantenimiento programado';
  }

  // Cálculo de segundos transcurridos
  let initialSecs = 0;
  let formattedTime = '00:00 min';

  if (serverCub.visualStatus === 'INACTIVO') {
    formattedTime = 'Fuera de servicio';
  } else if (serverCub.visualStatus === 'DISPONIBLE') {
    if (serverCub.idleSinceAt) {
      initialSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(serverCub.idleSinceAt).getTime()) / 1000),
      );
    }
    formattedTime = formatIdleTime(initialSecs);
  } else if (serverCub.visualStatus === 'LLAMANDO') {
    if (serverCub.calledAt) {
      initialSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(serverCub.calledAt).getTime()) / 1000),
      );
    }
    formattedTime = formatElapsedTime(initialSecs);
  } else {
    // ATENDIENDO o SLA_EXCEDIDO
    if (serverCub.serviceStartedAt) {
      initialSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(serverCub.serviceStartedAt).getTime()) / 1000),
      );
    }
    formattedTime = formatElapsedTime(initialSecs);
  }

  const isFullWidth = serverCub.cubicleCode.endsWith('05') || serverCub.cubicleCode === 'CUB-05';

  return {
    id: serverCub.cubicleCode,
    name: serverCub.displayName,
    moduleCode: (serverCub.moduleCode as 'MOD-A' | 'MOD-B' | 'MOD-C') || 'MOD-A',
    status: serverCub.visualStatus,
    assignedTicket: serverCub.activeTicketPublicCode,
    operatorName: serverCub.operatorDisplayName,
    elapsedSeconds: initialSecs,
    elapsedTimeFormatted: formattedTime,
    statusFooterText,
    dailyProcessedCount: serverCub.dailyCompletedCount,
    fullWidth: isFullWidth,
    startedAtIso: serverCub.serviceStartedAt,
    idleSinceIso: serverCub.idleSinceAt,
    calledAtIso: serverCub.calledAt,
    stateChangedAtIso: serverCub.stateChangedAt,
    slaThresholdSeconds: serverCub.slaThresholdSeconds,
  };
}

function mapServerQueue(serverQueue: TelemetryQueuedTicket[]): QueuedTicket[] {
  return serverQueue.map((t) => {
    const waitingSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(t.issuedAtIso).getTime()) / 1000),
    );
    return {
      position: t.position,
      ticketCode: t.ticketPublicCode,
      priority: t.queueCategory === 'PREFERENTIAL' ? 'PREFERENCIAL' : 'GENERAL',
      issuedAt: t.issuedAtFormatted,
      waitingSeconds,
      issuedAtIso: t.issuedAtIso,
    };
  });
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useOperationalTelemetry(enabled = true): OperationalTelemetryHookResult {
  const [cubicles, setCubicles] = useState<CubicleStation[]>(FALLBACK_CUBICLES);
  const [queue, setQueue] = useState<QueuedTicket[]>(FALLBACK_QUEUE);
  const [kpis, setKpis] = useState<TelemetryDailyKpis>(FALLBACK_KPIS);
  const [slaAlert, setSlaAlert] = useState<TelemetrySlaAlert>(FALLBACK_SLA_ALERT);
  const [hourlyFlow, setHourlyFlow] = useState<HourlyFlowEntry[]>(FALLBACK_HOURLY_FLOW);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState<number>(18);

  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Conexión WebSocket al namespace /operational-telemetry ────────────────
  useEffect(() => {
    if (!enabled) return;

    // Conexión con socket.io
    const socket = io('/operational-telemetry', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      // Medir latencia inmediatamente al conectar
      socket.emit(TELEMETRY_EVENTS.PING, { clientSentAt: Date.now() });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('fallback');
    });

    // ─── Receptor: Snapshot completo ─────────────────────────────────────────
    socket.on(TELEMETRY_EVENTS.SNAPSHOT, (snapshot: TelemetrySnapshotPayload) => {
      if (snapshot.cubicles && snapshot.cubicles.length > 0) {
        setCubicles(snapshot.cubicles.map(mapServerCubicle));
      }
      if (snapshot.queue) {
        setQueue(mapServerQueue(snapshot.queue));
      }
      if (snapshot.kpis) {
        setKpis(snapshot.kpis);
      }
      if (snapshot.slaAlert) {
        setSlaAlert(snapshot.slaAlert);
      }
      if (snapshot.hourlyFlow) {
        const currentHour = `${String(new Date().getHours()).padStart(2, '0')}:00`;
        setHourlyFlow(
          snapshot.hourlyFlow.map((hf) => ({
            hour: hf.hour,
            volume: hf.count,
            isCurrentHour: hf.hour === currentHour,
          })),
        );
      }
      setConnectionStatus('connected');
    });

    // ─── Receptor: Cambio de estado de un cubículo ────────────────────────────
    socket.on(TELEMETRY_EVENTS.CUBICLE_STATE_CHANGED, (payload: CubicleStateChangedPayload) => {
      const updatedStation = mapServerCubicle(payload.cubicle);
      setCubicles((prev) => {
        const index = prev.findIndex((c) => c.id === updatedStation.id);
        if (index === -1) {
          return [...prev, updatedStation];
        }
        const next = [...prev];
        next[index] = updatedStation;
        return next;
      });
    });

    // ─── Receptor: Actualización de cola / KPIs / Alerta SLA ──────────────────
    socket.on(TELEMETRY_EVENTS.QUEUE_UPDATED, (payload: QueueUpdatedPayload) => {
      if (payload.queue) {
        setQueue(mapServerQueue(payload.queue));
      }
      if (payload.kpis) {
        setKpis(payload.kpis);
      }
      if (payload.slaAlert) {
        setSlaAlert(payload.slaAlert);
      }
    });

    // ─── Receptor: Pong de latencia ──────────────────────────────────────────
    socket.on(TELEMETRY_EVENTS.PONG, (pong: TelemetryPongPayload) => {
      if (pong?.clientSentAt) {
        const rtt = Math.max(1, Math.round(Date.now() - pong.clientSentAt));
        setLatencyMs(rtt);
      }
    });

    // ─── Intervalo periódico de Ping (cada 10 segundos) ──────────────────────
    pingIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit(TELEMETRY_EVENTS.PING, { clientSentAt: Date.now() });
      }
    }, 10000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  // ─── Ticker local de 1 segundo para interpolación fluida ────────────────────
  const tick = useCallback(() => {
    const nowMs = Date.now();

    // Actualiza contadores de cubículos basados en Date.now() - timestamp del servidor
    setCubicles((prev) =>
      prev.map((c) => {
        if (c.status === 'INACTIVO') return c;

        let totalSecs = c.elapsedSeconds;
        let visualStatus: CubicleStatus = c.status;

        if (c.status === 'DISPONIBLE') {
          if (c.idleSinceIso) {
            totalSecs = Math.max(0, Math.floor((nowMs - new Date(c.idleSinceIso).getTime()) / 1000));
          } else {
            totalSecs += 1;
          }
          return {
            ...c,
            elapsedSeconds: totalSecs,
            elapsedTimeFormatted: formatIdleTime(totalSecs),
          };
        }

        if (c.status === 'LLAMANDO') {
          if (c.calledAtIso) {
            totalSecs = Math.max(0, Math.floor((nowMs - new Date(c.calledAtIso).getTime()) / 1000));
          } else {
            totalSecs += 1;
          }
          return {
            ...c,
            elapsedSeconds: totalSecs,
            elapsedTimeFormatted: formatElapsedTime(totalSecs),
          };
        }

        // ATENDIENDO o SLA_EXCEDIDO
        if (c.startedAtIso) {
          totalSecs = Math.max(0, Math.floor((nowMs - new Date(c.startedAtIso).getTime()) / 1000));
          const threshold = c.slaThresholdSeconds || 720;
          if (totalSecs > threshold && visualStatus === 'ATENDIENDO') {
            visualStatus = 'SLA_EXCEDIDO';
          }
        } else {
          totalSecs += 1;
        }

        return {
          ...c,
          status: visualStatus,
          elapsedSeconds: totalSecs,
          elapsedTimeFormatted: formatElapsedTime(totalSecs),
          statusFooterText:
            visualStatus === 'SLA_EXCEDIDO'
              ? `Umbral superado (>${Math.round((c.slaThresholdSeconds || 720) / 60)} min)`
              : c.statusFooterText,
        };
      }),
    );

    // Actualiza contadores de cola basados en Date.now() - issuedAtIso
    setQueue((prev) =>
      prev.map((t) => {
        let waitingSeconds = t.waitingSeconds;
        if (t.issuedAtIso) {
          waitingSeconds = Math.max(0, Math.floor((nowMs - new Date(t.issuedAtIso).getTime()) / 1000));
        } else {
          waitingSeconds += 1;
        }
        return {
          ...t,
          waitingSeconds,
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [enabled, tick]);

  // ─── Acciones expuestas al consumidor ───────────────────────────────────────

  /** Fuerza solicitud de snapshot al backend */
  const forceRefresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(TELEMETRY_EVENTS.REQUEST_SNAPSHOT, {});
      socketRef.current.emit(TELEMETRY_EVENTS.PING, { clientSentAt: Date.now() });
    }
  }, []);

  /** Envía un aviso general para proyectar en monitores */
  const sendBroadcastNotice = useCallback(
    (message: string, severity: 'info' | 'warning' | 'critical' = 'info') => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(TELEMETRY_EVENTS.BROADCAST_NOTICE, { message, severity });
      }
    },
    [],
  );

  return {
    cubicles,
    queue,
    kpis,
    slaAlert,
    hourlyFlow,
    connectionStatus,
    latencyMs,
    forceRefresh,
    sendBroadcastNotice,
  };
}
