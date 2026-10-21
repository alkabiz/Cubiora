import React, { useState } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  Power,
  ArrowLeft,
} from 'lucide-react';

export const CubiclesConfigView: React.FC = () => {
  const { cubicles, activateCubicle, deactivateCubicle, setCurrentView } = usePharmacy();
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({
    '01': 'Lic. M. Arismendi',
    '02': 'Farm. J. Duarte',
    '03': 'Lic. R. Mendoza',
    '04': 'Farm. S. Quintero',
    '05': 'Farm. Auxiliar Guardia',
  });

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 lg:px-8 py-6 flex flex-col gap-6">
        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[#475569] text-xs mb-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#006591] font-semibold">
                SCR-ADM-002
              </span>
              <span>·</span>
              <span>Parametrización de Puestos y Ventanillas</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('admin')}
                className="p-1 rounded hover:bg-[#eff4ff] text-[#006591]"
                title="Volver a métricas"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl md:text-2xl text-[#001428] tracking-tight font-bold">
                [SCR-ADM-002] Administración · Configuración de Cubículos
              </h1>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('admin')}
            className="px-3 py-1.5 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#001428] text-xs font-semibold rounded-lg border border-[#CBD5E1]"
          >
            ← Volver al Panel General
          </button>
        </div>

        {/* Cubicles Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cubicles.map((c) => {
            const isInactive = c.status === 'inactive';
            return (
              <div
                key={c.id}
                className={`p-5 rounded-xl border flex flex-col justify-between gap-4 transition-all shadow-xs ${
                  isInactive
                    ? 'bg-white/60 border-[#CBD5E1] opacity-80'
                    : 'bg-white border-[#E2E8F0] hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                        isInactive
                          ? 'bg-[#e5eeff] text-[#64748B]'
                          : 'bg-[#eff4ff] text-[#006591]'
                      }`}
                    >
                      {c.id}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#001428]">{c.name}</h3>
                      <span className="font-mono text-[11px] text-[#64748B]">
                        Módulo {c.moduleType}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                      c.status === 'busy'
                        ? 'bg-[#eff4ff] text-[#1D4ED8]'
                        : c.status === 'calling'
                        ? 'bg-[#F5F3FF] text-[#5B21B6]'
                        : c.status === 'exceeded'
                        ? 'bg-[#ffdad6] text-[#ba1a1a]'
                        : c.status === 'available'
                        ? 'bg-[#ECFDF5] text-[#065F46]'
                        : 'bg-[#e5eeff] text-[#64748B]'
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                </div>

                <div className="bg-[#eff4ff] p-3 rounded-lg flex flex-col gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-[#64748B] block mb-1">
                      Farmacéutico Asignado:
                    </label>
                    <input
                      type="text"
                      value={operatorNames[c.id] || c.operator}
                      onChange={(e) =>
                        setOperatorNames({ ...operatorNames, [c.id]: e.target.value })
                      }
                      className="w-full text-xs p-1.5 rounded border border-[#CBD5E1] bg-white text-[#001428]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#64748B]">Umbral SLA:</span>
                    <span className="font-mono font-bold text-[#001428]">
                      {c.slaExceededThresholdSeconds / 60} min
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B]">Turnos atendidos hoy:</span>
                    <span className="font-mono font-bold text-[#006591]">
                      {c.assignedTicketsCountToday} turnos
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B]">
                    {isInactive ? 'Deshabilitado' : 'Operativo en cola'}
                  </span>
                  {isInactive ? (
                    <button
                      onClick={() => activateCubicle(c.id)}
                      className="px-3 py-1.5 bg-[#065F46] hover:bg-[#044E38] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1"
                    >
                      <Power className="w-3.5 h-3.5" /> Habilitar
                    </button>
                  ) : (
                    <button
                      onClick={() => deactivateCubicle(c.id)}
                      className="px-3 py-1.5 bg-white border border-[#CBD5E1] hover:bg-[#ffdad6]/30 text-[#ba1a1a] text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1"
                    >
                      <Power className="w-3.5 h-3.5" /> Desactivar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
