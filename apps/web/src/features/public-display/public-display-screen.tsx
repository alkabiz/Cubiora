// ─── [SCR-PUB-001] PublicDisplayScreen — Pantalla de Sala de Espera (10-Foot UI)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PublicBroadcastNotice } from '@cubiora/shared';
import { PublicDisplayHeader } from './public-display-header';
import { ActiveCallHero } from './active-call-hero';
import { RecentCallsPanel } from './recent-calls-panel';
import { BroadcastNoticeBar } from './broadcast-notice-bar';
import { playChimeSound, initAudioContext } from './audio-chime';
import { apiClient } from '../../lib/api';
import type { PublicTicketCall, PublicDisplayNotice } from './types';

interface RawCallData {
  id?: string;
  publicCode?: string;
  ticketCode?: string;
  cubicleDisplayName?: string;
  cubicleName?: string;
  moduleCode?: string;
  priority?: 'GENERAL' | 'PREFERENCIAL';
  calledAt?: string;
  calledAtIso?: string;
  callNumber?: number;
  callCount?: number;
}

interface RawSnapshotResponse {
  currentCall?: RawCallData | null;
  recentCalls?: RawCallData[];
  activeNotice?: PublicBroadcastNotice | null;
}

function parseCallData(raw: RawCallData | null | undefined): PublicTicketCall | null {
  if (!raw) return null;
  const ticketCode = raw.publicCode || raw.ticketCode;
  if (!ticketCode) return null;

  return {
    id: raw.id || ticketCode,
    ticketCode,
    cubicleName: raw.cubicleDisplayName || raw.cubicleName || 'Cubículo',
    moduleCode: raw.moduleCode,
    priority: raw.priority === 'PREFERENCIAL' ? 'PREFERENCIAL' : 'GENERAL',
    calledAtIso: raw.calledAt || raw.calledAtIso || new Date().toISOString(),
    callCount: raw.callNumber || raw.callCount || 1,
  };
}

function normalizeBroadcastNotice(
  raw: Partial<PublicBroadcastNotice> | null | undefined,
): PublicDisplayNotice | null {
  if (!raw || typeof raw.message !== 'string') return null;
  const trimmed = raw.message.trim();
  if (trimmed.length === 0) return null;

  if (raw.expiresAtIso) {
    const expiresAtMs = Date.parse(raw.expiresAtIso);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      return null;
    }
  }

  const normalizedSeverity = String(raw.severity ?? 'warning').toLowerCase();
  const severity: PublicBroadcastNotice['severity'] =
    normalizedSeverity === 'critical'
      ? 'critical'
      : normalizedSeverity === 'info'
        ? 'info'
        : 'warning';

  return {
    message: trimmed,
    severity,
    issuedAtIso: raw.issuedAtIso || new Date().toISOString(),
    expiresAtIso: raw.expiresAtIso,
  };
}

export const PublicDisplayScreen: React.FC = () => {
  const [currentCall, setCurrentCall] = useState<PublicTicketCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<PublicTicketCall[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'ONLINE' | 'RECONNECTING' | 'OFFLINE'>('RECONNECTING');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeNotice, setActiveNotice] = useState<PublicDisplayNotice | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  const isMountedRef = useRef(true);
  const wasReconnectingRef = useRef(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const applyNotice = useCallback((rawNotice: Partial<PublicBroadcastNotice> | null | undefined) => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }

    const parsed = normalizeBroadcastNotice(rawNotice);
    setActiveNotice(parsed);

    if (parsed?.expiresAtIso) {
      const remainingMs = Date.parse(parsed.expiresAtIso) - Date.now();
      if (Number.isFinite(remainingMs) && remainingMs > 0) {
        noticeTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setActiveNotice(null);
          }
        }, remainingMs);
      }
    }
  }, []);

  const triggerCallFlash = useCallback(() => {
    setIsFlashing(true);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsFlashing(false);
      }
    }, 4000);
  }, []);

  const handleToggleSound = () => {
    if (!soundEnabled) {
      initAudioContext();
      setSoundEnabled(true);
    } else {
      setSoundEnabled(false);
    }
  };

  // Reactivación automática de audio tras la primera interacción del usuario (Autoplay Policy compliance)
  useEffect(() => {
    if (soundEnabled) return;

    const handleFirstGesture = () => {
      initAudioContext();
      setSoundEnabled(true);
    };

    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [soundEnabled]);

  // Cargar Snapshot inicial del backend
  const loadSnapshot = useCallback(async () => {
    try {
      const res = await apiClient<{ success: boolean; data: RawSnapshotResponse }>(
        '/public-display/snapshot',
      );
      if (!isMountedRef.current) return;

      const snapshotData = res?.data;
      if (snapshotData) {
        if ('currentCall' in snapshotData) {
          setCurrentCall(parseCallData(snapshotData.currentCall));
        }
        if (Array.isArray(snapshotData.recentCalls)) {
          const parsed = snapshotData.recentCalls
            .map(parseCallData)
            .filter((c): c is PublicTicketCall => c !== null);
          setRecentCalls(parsed);
        }
        if ('activeNotice' in snapshotData) {
          applyNotice(snapshotData.activeNotice);
        }
      }
      setConnectionStatus('ONLINE');
    } catch {
      if (!isMountedRef.current) return;
      setConnectionStatus('OFFLINE');
    }
  }, [applyNotice]);

  // Conexión SSE en vivo con Backoff Exponencial y Jitter (Resiliencia ante caídas de red)
  useEffect(() => {
    isMountedRef.current = true;
    void loadSnapshot();

    const eventSourceUrl = '/api/v1/public-display/events';
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const connectSSE = () => {
      try {
        if (typeof EventSource === 'undefined') return;

        eventSource = new EventSource(eventSourceUrl);

        eventSource.onopen = () => {
          setConnectionStatus('ONLINE');
          reconnectAttempts = 0; // Reinicia contador tras conexión exitosa
          if (wasReconnectingRef.current) {
            void loadSnapshot();
            wasReconnectingRef.current = false;
          }
        };

        eventSource.onerror = () => {
          setConnectionStatus('RECONNECTING');
          wasReconnectingRef.current = true;
          eventSource?.close();

          // Backoff exponencial con jitter: base 2s, factor 1.8, tope 30s, jitter ±500ms
          const exponentialDelay = Math.min(2000 * Math.pow(1.8, reconnectAttempts), 30000);
          reconnectAttempts += 1;
          const jitter = (Math.random() - 0.5) * 1000;
          const delay = Math.max(1000, Math.round(exponentialDelay + jitter));

          reconnectTimeout = setTimeout(connectSSE, delay);
        };

        const handleCallEvent = (e: MessageEvent) => {
          try {
            const rawData: RawCallData = JSON.parse(e.data);
            const call = parseCallData(rawData);
            if (!call) return;

            setCurrentCall((prevCurrent) => {
              if (prevCurrent && prevCurrent.ticketCode !== call.ticketCode) {
                setRecentCalls((prevRecents) => {
                  const filtered = prevRecents.filter((c) => c.ticketCode !== prevCurrent.ticketCode);
                  return [prevCurrent, ...filtered].slice(0, 4);
                });
              }
              return call;
            });

            if (soundEnabledRef.current) {
              playChimeSound();
            }
            triggerCallFlash();
          } catch {
            // Ignorar formato no parseable
          }
        };

        const handleNoticeEvent = (e: MessageEvent) => {
          try {
            const rawNotice = JSON.parse(e.data) as Partial<PublicBroadcastNotice>;
            applyNotice(rawNotice);
          } catch {
            // Ignorar aviso malformado
          }
        };

        eventSource.addEventListener('ticket.called', handleCallEvent);
        eventSource.addEventListener('ticket.recalled', handleCallEvent);
        eventSource.addEventListener('admin.notice', handleNoticeEvent);
      } catch {
        setConnectionStatus('OFFLINE');
        const exponentialDelay = Math.min(2000 * Math.pow(1.8, reconnectAttempts), 30000);
        reconnectAttempts += 1;
        const delay = Math.max(1000, Math.round(exponentialDelay + (Math.random() - 0.5) * 1000));
        reconnectTimeout = setTimeout(connectSSE, delay);
      }
    };

    connectSSE();

    return () => {
      isMountedRef.current = false;
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, [applyNotice, loadSnapshot, triggerCallFlash]);

  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col justify-between select-none bg-[#020B14]">
      {/* ─── Header Superior de Sala ─── */}
      <PublicDisplayHeader
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        connectionStatus={connectionStatus}
      />

      {/* ─── Zona Split-Screen ─── */}
      <main className="grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8 flex-1 items-stretch">
        <ActiveCallHero currentCall={currentCall} isFlashing={isFlashing} />
        <RecentCallsPanel recentCalls={recentCalls} />
      </main>

      {/* ─── Barra Inferior / Aviso General ─── */}
      <BroadcastNoticeBar notice={activeNotice} />
    </div>
  );
};

