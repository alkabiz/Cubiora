// ─── [SCR-PUB-001] PublicDisplayHeader — Header Superior de Sala ──────────────
import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface PublicDisplayHeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  connectionStatus: 'ONLINE' | 'RECONNECTING' | 'OFFLINE';
}

function getFormattedTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const PublicDisplayHeader: React.FC<PublicDisplayHeaderProps> = ({
  soundEnabled,
  onToggleSound,
  connectionStatus,
}) => {
  const [currentTime, setCurrentTime] = useState<string>(getFormattedTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getFormattedTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-[#04101E] border-b border-slate-800/80">
      {/* ─── Izquierda: Identidad de Marca ─── */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-[#03101D] font-mono font-extrabold text-xl leading-none shadow-sm"
          aria-hidden="true"
        >
          C
        </div>
        <div className="flex items-baseline">
          <span className="text-xl font-bold tracking-tight text-white">Cubiora</span>
          <span className="text-sm font-medium text-slate-400 ml-2">Turnos</span>
        </div>
      </div>

      {/* ─── Derecha: Controles de Audio, Reloj y Estado de Red ─── */}
      <div className="flex items-center gap-4">
        {/* Botón interactivo de Audio con Foco Visible (WCAG 2.4.7 AA) y tamaño accesible (WCAG 2.5.8 AA) */}
        <button
          type="button"
          onClick={onToggleSound}
          title={soundEnabled ? 'Silenciar llamados' : 'Activar timbre sonoro'}
          className={
            soundEnabled
              ? 'bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700 px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04101E]'
              : 'bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04101E]'
          }
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Sonido activo</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-amber-400" />
              <span>Sonido desactivado (Clic para activar)</span>
            </>
          )}
        </button>

        {/* Reloj en Tiempo Real */}
        <div className="text-sm font-mono font-semibold text-slate-300 tabular-nums px-3 border-x border-slate-800">
          {currentTime}
        </div>

        {/* Indicador de Conexión Live */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'ONLINE' && (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase">
                EN LÍNEA
              </span>
            </>
          )}
          {connectionStatus === 'RECONNECTING' && (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
                RECONECTANDO
              </span>
            </>
          )}
          {connectionStatus === 'OFFLINE' && (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs font-mono font-bold tracking-wider text-red-400 uppercase">
                DESCONECTADO
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

