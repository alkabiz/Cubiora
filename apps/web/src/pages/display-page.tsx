import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PublicCall, PublicDisplaySnapshot } from '@cubiora/shared';
import { Flex, Box, Text, Button } from '@radix-ui/themes';
import { SpeakerLoudIcon, SpeakerOffIcon } from '@radix-ui/react-icons';
import { apiClient } from '../lib/api';

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
}

export const DisplayPage: React.FC = () => {
  const [currentCall, setCurrentCall] = useState<PublicCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<PublicCall[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'reconnecting' | 'offline'>('reconnecting');
  const [audioEnabled, setAudioEnabled] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const wasReconnectingRef = useRef(false);

  // Reproducir timbre suave y discreto con Web Audio API (opcional y accesible)
  const playChime = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const ctx = audioContextRef.current || getAudioContext();
      if (!ctx) return;
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch {
      // Ignorar errores si el navegador bloquea audio
    }
  }, [audioEnabled]);

  const toggleAudio = () => {
    if (!audioEnabled) {
      // Inicializar AudioContext con el gesto del usuario
      try {
        const ctx = getAudioContext();
        if (ctx) {
          audioContextRef.current = ctx;
          ctx.resume();
        }
      } catch {
        // Ignorar
      }
      setAudioEnabled(true);
    } else {
      setAudioEnabled(false);
    }
  };

  // 1. Solicitar Snapshot completo
  const loadSnapshot = useCallback(async () => {
    try {
      const res = await apiClient<{ success: boolean; data: PublicDisplaySnapshot }>(
        '/public-display/snapshot',
      );
      if (res.data) {
        setCurrentCall(res.data.currentCall);
        setRecentCalls(res.data.recentCalls || []);
      }
      setConnectionStatus('online');
    } catch {
      setConnectionStatus('offline');
    }
  }, []);

  // 2. Conexión SSE
  useEffect(() => {
    loadSnapshot();

    const eventSourceUrl = '/api/v1/public-display/events';
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connectSSE = () => {
      try {
        eventSource = new EventSource(eventSourceUrl);

        eventSource.onopen = () => {
          setConnectionStatus('online');
          if (wasReconnectingRef.current) {
            // Tras reconexión, solicitar snapshot para conciliar posibles llamados omitidos
            loadSnapshot();
            wasReconnectingRef.current = false;
          }
        };

        eventSource.onerror = () => {
          setConnectionStatus('reconnecting');
          wasReconnectingRef.current = true;
          eventSource?.close();
          reconnectTimeout = setTimeout(connectSSE, 4000);
        };

        const handleCallEvent = (e: MessageEvent) => {
          try {
            const callData: PublicCall = JSON.parse(e.data);
            setCurrentCall((prevCurrent) => {
              // Si el turno llamado es diferente al actual, desplazar el actual a recientes
              if (prevCurrent && prevCurrent.publicCode !== callData.publicCode) {
                setRecentCalls((prevRecents) => {
                  const filtered = prevRecents.filter((c) => c.publicCode !== prevCurrent.publicCode);
                  return [prevCurrent, ...filtered].slice(0, 4);
                });
              }
              return callData;
            });
            playChime();
          } catch {
            // Ignorar formato no parseable
          }
        };

        eventSource.addEventListener('ticket.called', handleCallEvent);
        eventSource.addEventListener('ticket.recalled', handleCallEvent);
      } catch {
        setConnectionStatus('offline');
        reconnectTimeout = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [loadSnapshot, playChime]);

  return (
    <Box
      className="min-h-screen flex flex-col bg-[#001428] text-white"
      style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#001428',
        color: '#ffffff',
      }}
    >
      {/* ─── Encabezado institucional de la Pantalla Pública ────────────── */}
      <header
        className="px-6 py-4 flex items-center justify-between border-b border-slate-800"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        <Flex align="center" gap="3">
          <Box className="w-9 h-9 rounded-md bg-teal-600 flex items-center justify-center font-bold text-base text-white">
            C
          </Box>
          <Text size="5" weight="bold" className="tracking-wide">
            Cubiora
          </Text>
          <Text size="3" className="text-slate-400 font-medium">
            Turnos
          </Text>
        </Flex>

        <Flex align="center" gap="4">
          {/* Botón de audio opcional accesible */}
          <Button
            size="1"
            variant="ghost"
            color="gray"
            onClick={toggleAudio}
            style={{ cursor: 'pointer', color: audioEnabled ? '#2dd4bf' : '#94a3b8' }}
            title={audioEnabled ? 'Silenciar llamados' : 'Activar timbre sonoro'}
          >
            {audioEnabled ? <SpeakerLoudIcon width={16} height={16} /> : <SpeakerOffIcon width={16} height={16} />}
            <Text size="1">{audioEnabled ? 'Sonido activo' : 'Sonido desactivado'}</Text>
          </Button>

          {/* Estado de conexión discreto */}
          <Flex align="center" gap="2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <Text size="1" className="text-slate-400 font-medium tracking-wider uppercase">
              {connectionStatus === 'online'
                ? 'En línea'
                : connectionStatus === 'reconnecting'
                ? 'Reconectando...'
                : 'Sin conexión'}
            </Text>
          </Flex>
        </Flex>
      </header>

      {/* ─── Contenido Principal: Pantalla de Gran Formato ──────────────── */}
      <main className="flex-1 p-6 md:p-10 flex flex-col lg:flex-row gap-8 items-stretch">
        {/* Columna Izquierda / Panel Principal: Turno en llamado (flex-2) */}
        <Box
          className="flex-1 lg:flex-[2] flex flex-col justify-center items-center text-center p-8 md:p-12 rounded-2xl bg-[#001e38] border-2 border-teal-500/40 shadow-2xl"
          style={{
            background: '#001e38',
            borderRadius: '1.25rem',
            border: '2px solid rgba(20, 184, 166, 0.4)',
          }}
        >
          <Text
            size="3"
            weight="medium"
            className="text-teal-400 uppercase tracking-widest block mb-4"
          >
            Turno llamado
          </Text>

          <Text
            weight="bold"
            className="font-mono block text-white"
            style={{
              fontSize: 'clamp(3rem, 8vw, 6.5rem)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {currentCall?.publicCode || '---'}
          </Text>

          <Text
            size="4"
            className="text-slate-400 block mt-6 mb-2 font-medium"
          >
            Diríjase al
          </Text>

          <Text
            weight="bold"
            className="text-teal-300 block"
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              lineHeight: 1.1,
            }}
          >
            {currentCall?.cubicleDisplayName || 'Cubículo'}
          </Text>
        </Box>

        {/* Columna Derecha: Llamados recientes (flex-1) */}
        <Box
          className="flex-1 lg:flex-[1] flex flex-col p-6 rounded-2xl bg-[#001a30] border border-slate-800"
          style={{
            background: '#001a30',
            borderRadius: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Text
            size="2"
            weight="bold"
            className="text-slate-400 uppercase tracking-wider block mb-4 pb-2 border-b border-slate-800"
          >
            Llamados recientes
          </Text>

          <Flex direction="column" gap="3" className="flex-1 justify-around">
            {recentCalls.length === 0 ? (
              <Box className="py-8 text-center">
                <Text size="2" className="text-slate-500">
                  Sin llamados previos
                </Text>
              </Box>
            ) : (
              recentCalls.slice(0, 4).map((item, index) => (
                <Box
                  key={item.publicCode + index}
                  className="p-4 rounded-xl bg-[#002240] border border-slate-800/80 flex items-center justify-between gap-4"
                  style={{
                    background: '#002240',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {/* Número de turno en monoespacio */}
                  <Text
                    size="5"
                    weight="bold"
                    className="font-mono text-white tracking-wide"
                  >
                    {item.publicCode}
                  </Text>

                  {/* Cubículo sin badge según preferencia normativa */}
                  <Text size="3" weight="bold" className="text-teal-300">
                    {item.cubicleDisplayName}
                  </Text>
                </Box>
              ))
            )}
          </Flex>
        </Box>
      </main>
    </Box>
  );
};
