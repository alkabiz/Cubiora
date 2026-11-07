// ─── [SCR-ADM-002] CubicleConfigCard — Tarjeta de Configuración de Cubículo ────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Power, CheckCircle2, RefreshCw } from 'lucide-react';
import { CUBICLE_STATUS_LABELS_ES } from '@cubiora/shared';
import type { CubicleConfigurationItem, CubicleBadgeCode } from './types';

interface CubicleConfigCardProps {
  item: CubicleConfigurationItem;
  onUpdatePharmacist: (id: string, name: string) => Promise<void> | void;
  onToggleStatus: (id: string) => void;
}

const BADGE_STYLES: Record<CubicleBadgeCode, string> = {
  BUSY: 'bg-blue-50 text-blue-700',
  EXCEEDED: 'bg-red-100/90 text-red-700',
  CALLING: 'bg-purple-50 text-purple-700',
  AVAILABLE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
};

export const CubicleConfigCard: React.FC<CubicleConfigCardProps> = ({
  item,
  onUpdatePharmacist,
  onToggleStatus,
}) => {
  const [inputValue, setInputValue] = useState(item.assignedPharmacist);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedValueRef = useRef(item.assignedPharmacist);

  // Sincronizar si cambia desde telemetría externa sin sobreescribir edición activa
  useEffect(() => {
    if (saveStatus !== 'saving' && saveStatus !== 'error') {
      setInputValue(item.assignedPharmacist);
      lastSavedValueRef.current = item.assignedPharmacist;
    }
  }, [item.assignedPharmacist, saveStatus]);

  const executeSave = useCallback(
    async (val: string) => {
      const trimmed = val.trim();
      if (trimmed === lastSavedValueRef.current) {
        return;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      setSaveStatus('saving');
      try {
        await onUpdatePharmacist(item.id, trimmed);
        lastSavedValueRef.current = trimmed;
        setSaveStatus('saved');
        if (clearStatusTimerRef.current) clearTimeout(clearStatusTimerRef.current);
        clearStatusTimerRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch {
        setSaveStatus('error');
      }
    },
    [item.id, onUpdatePharmacist],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInputValue(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Debounce de 600 ms según directiva
    debounceTimerRef.current = setTimeout(() => {
      void executeSave(nextVal);
    }, 600);
  };

  const handleBlur = () => {
    if (inputValue.trim() !== lastSavedValueRef.current) {
      void executeSave(inputValue);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (clearStatusTimerRef.current) clearTimeout(clearStatusTimerRef.current);
    };
  }, []);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
      {/* 1. Cabecera de Tarjeta */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-mono font-bold text-sm ${
                item.isEnabled ? 'text-blue-900' : 'text-slate-600'
              }`}
            >
              <span className="sr-only">Estación </span>
              {item.numberCode}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">{item.name}</h3>
              {/* Contraste accesible text-slate-600 sobre fondo blanco: 7.58:1 (WCAG 1.4.3 AA/AAA) */}
              <p className="text-xs font-mono text-slate-600 mt-0.5">{item.moduleLabel}</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
              BADGE_STYLES[item.badgeStatus]
            }`}
          >
            {CUBICLE_STATUS_LABELS_ES[item.badgeStatus] ?? item.badgeStatus}
          </span>
        </div>

        {/* 2. Caja Central de Parametrización */}
        <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-xl p-3.5 space-y-2.5">
          <div>
            <label
              htmlFor={`operator-${item.id}`}
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Farmacéutico Asignado:
            </label>
            <input
              id={`operator-${item.id}`}
              type="text"
              value={inputValue}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B5793] focus:border-[#0B5793] transition-colors ${
                item.isEnabled ? 'text-slate-900' : 'text-slate-700'
              }`}
            />

            {/* Estado de guardado accesible (WCAG 4.1.3 Nivel AA) */}
            <div role="status" aria-live="polite" className="h-4 text-[11px] flex items-center gap-1.5 mt-1.5">
              {saveStatus === 'saving' && (
                <span className="text-blue-700 flex items-center gap-1 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                  Guardando…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                  Guardado
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-700 flex items-center gap-1 font-medium">
                  <span>Error al guardar</span>
                  <button
                    type="button"
                    onClick={() => void executeSave(inputValue)}
                    className="text-xs text-blue-700 underline font-semibold ml-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
                  >
                    Reintentar
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-700 font-medium">Umbral SLA:</span>
            <span className="font-mono font-bold text-slate-900">
              {item.slaThresholdMinutes} min
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-700 font-medium">Turnos atendidos hoy:</span>
            <span className="font-mono font-bold text-blue-800">
              {item.dailyProcessedCount} turnos
            </span>
          </div>
        </div>
      </div>

      {/* 3. Footer de Estado y Acción (WCAG 2.5.8 AA min-h-[36px] >= 24px) */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
        <div>
          {item.isEnabled ? (
            <span className="text-xs font-medium text-slate-700">Operativo en cola</span>
          ) : (
            <span className="text-xs font-medium text-slate-600">Deshabilitado</span>
          )}
        </div>

        {item.isEnabled ? (
          <button
            type="button"
            onClick={() => onToggleStatus(item.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-lg border border-slate-300 bg-white hover:bg-red-50 hover:border-red-300 text-red-700 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793] focus-visible:ring-offset-2"
          >
            <Power className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
            Desactivar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleStatus(item.id)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 min-h-[36px] rounded-lg bg-[#2F6F5E] hover:bg-[#25584B] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5793] focus-visible:ring-offset-2"
          >
            <Power className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            Habilitar
          </button>
        )}
      </div>
    </div>
  );
};

