import React from 'react';
import { usePharmacy, ScreenView } from '../context/PharmacyContext';
import { Volume2, VolumeX, Clock, Building } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    currentTimeString,
    audioEnabled,
    setAudioEnabled,
    triggerChime,
  } = usePharmacy();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#ffffff] border-b border-[#E2E8F0] shadow-[0_1px_8px_rgba(0,0,0,0.04)] h-16">
      <div className="h-16 w-full px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: Brand & Clinical Point */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0">
          <button
            onClick={() => setCurrentView('admin')}
            className="flex items-center gap-2.5 text-left focus:outline-none group"
            title="Ir a inicio de supervisión"
          >
            <img
              alt="Cubiora"
              className="h-9 w-9 rounded-lg object-contain shadow-xs transition-transform group-hover:scale-105"
              src="/cubiora-logo.svg"
            />
            <div className="flex flex-col">
              <span className="font-bold text-[18px] leading-tight text-[#0F2942] tracking-tight">
                Cubiora
              </span>
              <span className="text-[11px] text-[#475569] font-medium leading-none">
                Gestión Farmacéutica
              </span>
            </div>
          </button>

          <div className="hidden xl:flex items-center pl-4 border-l border-[#E2E8F0] gap-3">
            <div className="flex items-center gap-1.5 bg-[#eff4ff] px-2.5 py-1 rounded text-[#0F2942] text-[12px] font-semibold">
              <Building className="w-3.5 h-3.5 text-[#006591]" />
              <span>Punto de Dispensación Central</span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-1 rounded">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
              </span>
              <span className="font-mono text-[11px] font-medium text-[#065F46] tabular-nums">
                Conexión activa · Latencia 18ms
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[#475569] text-[12px]">
              <Clock className="w-3.5 h-3.5 text-[#64748B]" />
              <span className="font-mono tabular-nums">Hoy · {currentTimeString}</span>
            </div>
          </div>
        </div>


        {/* Right: Audio Control & Operator Profile */}
        <div className="flex items-center gap-3">
          {/* Audio Chime Trigger & Mute Toggle */}
          <div className="flex items-center gap-1 bg-[#eff4ff] p-1 rounded-lg border border-[#E2E8F0]">
            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) triggerChime();
              }}
              className={`p-1.5 rounded transition-colors ${
                audioEnabled
                  ? 'text-[#006591] hover:bg-[#e5eeff]'
                  : 'text-[#94A3B8] hover:bg-[#e5eeff]'
              }`}
              title={audioEnabled ? 'Sonido de aviso activado (Clic para silenciar)' : 'Sonido silenciado (Clic para activar)'}
              aria-label="Silenciar o activar avisos sonoros"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={triggerChime}
              className="text-[11px] font-medium text-[#006591] hover:underline px-1.5 py-0.5"
              title="Probar sonido de campana de sala"
            >
              Timbre
            </button>
          </div>

          {/* Operator Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
            <div className="w-8 h-8 rounded-full bg-[#0F2942] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#0EA5E9]/20">
              RM
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[13px] font-semibold text-[#0F2942] leading-tight">
                Lic. R. Mendoza
              </span>
              <span className="text-[11px] text-[#475569] leading-none">
                Farmacéutico Reg. 4812
              </span>
            </div>
          </div>

          {/* Quick Screen Switcher for Mobile */}
          <div className="flex md:hidden">
            <select
              value={currentView}
              onChange={(e) => setCurrentView(e.target.value as ScreenView)}
              className="text-xs bg-[#eff4ff] border border-[#cbd5e1] rounded p-1 text-[#0F2942] font-medium"
            >
              <option value="admin">Administración</option>
              <option value="reception">Recepción</option>
              <option value="cubicle">Mi Cubículo</option>
              <option value="public">Monitor Público</option>
              <option value="cubicles_config">Config Cubículos</option>
              <option value="history">Historial</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
