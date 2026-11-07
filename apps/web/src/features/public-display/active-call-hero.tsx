// ─── [SCR-PUB-001] ActiveCallHero — Zona Hero de Anuncio de Turno Activo ──────
import React from 'react';
import type { PublicTicketCall } from './types';

interface ActiveCallHeroProps {
  currentCall: PublicTicketCall | null;
  isFlashing: boolean;
}

export const ActiveCallHero: React.FC<ActiveCallHeroProps> = ({
  currentCall,
  isFlashing,
}) => {
  return (
    <section
      role="region"
      aria-label="Turno llamado actualmente"
      aria-live="assertive"
      aria-atomic="true"
      className={`col-span-12 lg:col-span-8 flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-3xl relative overflow-hidden transition-all duration-500 ${
        isFlashing
          ? 'ring-4 ring-emerald-400/60 bg-[#06203A] shadow-[0_0_80px_-10px_rgba(16,185,129,0.35)]'
          : 'bg-[#041527] border-2 border-emerald-500/40 shadow-[0_0_60px_-15px_rgba(16,185,129,0.2)]'
      }`}
    >
      {currentCall ? (
        <>
          {/* Badge Superior con soporte de prioridad PREFERENCIAL */}
          <div className="flex items-center justify-center flex-wrap gap-2 mb-4 sm:mb-6">
            <span className="text-sm font-mono font-bold uppercase tracking-[0.25em] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-5 py-1.5 rounded-full">
              TURNO LLAMADO
            </span>

            {currentCall.priority === 'PREFERENCIAL' && (
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 border border-purple-400/30 px-3.5 py-1 rounded-full">
                Preferencial
              </span>
            )}
          </div>

          {/* Código del Turno Gigante */}
          <h1 className="font-mono font-extrabold text-5xl sm:text-7xl xl:text-8xl text-white tracking-tight tabular-nums my-2">
            {currentCall.ticketCode}
          </h1>

          {/* Instrucción de Paso */}
          <p className="text-xl xl:text-2xl text-slate-300 font-medium mt-6 mb-2">
            Diríjase al
          </p>

          {/* Destino Asignado (Cubículo) */}
          <div className="text-5xl sm:text-6xl xl:text-7xl font-extrabold text-emerald-400 tracking-tight">
            {currentCall.cubicleName}
          </div>

          {/* Texto accesible para lectores de pantalla */}
          <span className="sr-only">
            {`Atención: Turno ${currentCall.ticketCode}, por favor pasar al ${currentCall.cubicleName}`}
          </span>
        </>
      ) : (
        <div className="py-16">
          <span className="text-sm font-mono font-bold uppercase tracking-[0.25em] text-slate-400 bg-slate-800/40 border border-slate-700/60 px-5 py-1.5 rounded-full mb-6 inline-block">
            SALA DE ESPERA
          </span>
          <h1 className="font-mono font-extrabold text-4xl sm:text-5xl text-white tracking-tight my-4">
            Atención Continua de Turnos
          </h1>
          <p className="text-lg text-slate-400 max-w-md mx-auto">
            Por favor permanezca atento a la pantalla para el llamado de su turno.
          </p>
        </div>
      )}
    </section>
  );
};
