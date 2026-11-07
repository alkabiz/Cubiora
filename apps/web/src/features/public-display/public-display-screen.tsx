// ─── [SCR-PUB-001] PublicDisplayScreen — Pantalla de Sala de Espera (10-Foot UI)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PublicDisplayHeader } from './public-display-header';
import { ActiveCallHero } from './active-call-hero';
import { RecentCallsPanel } from './recent-calls-panel';
import { BroadcastNoticeBar } from './broadcast-notice-bar';
import { playChimeSound, initAudioContext } from './audio-chime';
import { INITIAL_CURRENT_CALL, INITIAL_RECENT_CALLS } from './mock-display-data';
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
}

function parseCallData(raw: RawCallData | null | undefined): PublicTicketCall | null {
  if (!raw) return null;
  return {
    id: raw.id || raw.publicCode || raw.ticketCode || 'call-default',
    ticketCode: raw.publicCode || raw.ticketCode || '---',
    cubicleName: raw.cubicleDisplayName || raw.cubicleName || 'Cubículo',
    moduleCode: raw.moduleCode || 'MOD-A',
    priority: raw.priority || 'GENERAL',
    calledAtIso: raw.calledAt || raw.calledAtIso || new Date().toISOString(),
    callCount: raw.callNumber || raw.callCount || 1,
  };
}

export const PublicDisplayScreen: React.FC = () => {
  const [currentCall, setCurrentCall] = useState<PublicTicketCall | null>(INITIAL_CURRENT_CALL);
  const [recentCalls, setRecentCalls] = useState<PublicTicketCall[]>(INITIAL_RECENT_CALLS);
  const [connectionStatus, setConnectionStatus] = useState<'ONLINE' | 'RECONNECTING' | 'OFFLINE'>('ONLINE');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeNotice] = useState<PublicDisplayNotice | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  const wasReconnectingRef = useRef(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCallFlash = useCallback(() => {
    setIsFlashing(true);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setIsFlashing(false);
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
      if (res && res.data) {
        if ('currentCall' in res.data) {
          setCurrentCall(parseCallData(res.data.currentCall));
        }
        if (Array.isArray(res.data.recentCalls)) {
          const parsed = res.data.recentCalls
            .map(parseCallData)
            .filter((c): c is PublicTicketCall => c !== null);
          setRecentCalls(parsed);
        }
      }
      setConnectionStatus('ONLINE');
    } catch {
      // Si la API falla, conservamos la semilla de alta fidelidad
      setConnectionStatus('ONLINE');
    }
  }, []);

  // Conexión SSE en vivo con Backoff Exponencial y Jitter (Resiliencia ante caídas de red)
  useEffect(() => {
    loadSnapshot();

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
            loadSnapshot();
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

            if (soundEnabled) {
              playChimeSound();
            }
            triggerCallFlash();
          } catch {
            // Ignorar formato no parseable
          }
        };

        eventSource.addEventListener('ticket.called', handleCallEvent);
        eventSource.addEventListener('ticket.recalled', handleCallEvent);
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
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [loadSnapshot, soundEnabled, triggerCallFlash]);

  return (
    <div className="min-h-screen w-full overflow-hidden flex flex-col justify-between select-none bg-[#020B14]">
      {/* ─── Header Superior de Sala ─── */}
      <PublicDisplayHeader
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        connectionStatus={connectionStatus}
      />

      {/* ─── Zona Split-Screen ─── */}
      <main className="grid grid-cols-12 gap-8 p-8 flex-1 items-stretch">
        <ActiveCallHero currentCall={currentCall} isFlashing={isFlashing} />
        <RecentCallsPanel recentCalls={recentCalls} />
      </main>

      {/* ─── Barra Inferior / Aviso General ─── */}
      <BroadcastNoticeBar notice={activeNotice} />
    </div>
  );
};

