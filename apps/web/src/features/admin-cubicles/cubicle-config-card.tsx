// ─── [SCR-ADM-002] CubicleConfigCard — Tarjeta de Configuración de Cubículo ────
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Power, CheckCircle2, RefreshCw } from 'lucide-react';
import { Select } from '@radix-ui/themes';
import {
  CUBICLE_STATUS_LABELS_ES,
  PHARMACIST_ROLE_SHORT_LABELS_ES,
  PharmacistStatus,
} from '@cubiora/shared';
import type {
  CubicleConfigurationItem,
  CubicleBadgeCode,
  PharmacistSelectOption,
} from './types';

export const UNASSIGNED_CUBICLE_PHARMACIST = '__UNASSIGNED__';

interface CubicleConfigCardProps {
  item: CubicleConfigurationItem;
  pharmacists: PharmacistSelectOption[];
  onAssignPharmacist: (
    cubicleId: string,
    pharmacistId: string | null,
    operatorName: string,
    signal?: AbortSignal,
  ) => Promise<void> | void;
  onToggleStatus: (id: string) => Promise<void> | void;
}

const BADGE_STYLES: Record<CubicleBadgeCode, string> = {
  BUSY: 'bg-[#0081cf]/12 text-[#0f172a] border border-[#0081cf]',
  EXCEEDED: 'bg-red-100/90 text-red-700',
  CALLING: 'bg-[#008e9b]/12 text-[#0f172a] border border-[#008e9b]',
  AVAILABLE: 'bg-[#008f7a]/12 text-[#0f172a] border border-[#008f7a]',
  INACTIVE: 'bg-slate-200 text-slate-800',
};

export const CubicleConfigCard: React.FC<CubicleConfigCardProps> = ({
  item,
  pharmacists,
  onAssignPharmacist,
  onToggleStatus,
}) => {
  const resolvedInitialSelection = useMemo(() => {
    if (item.pharmacistId) {
      return item.pharmacistId;
    }
    if (item.assignedPharmacist.trim().length > 0) {
      const matched = pharmacists.find(
        (p) => p.fullName.toLowerCase() === item.assignedPharmacist.trim().toLowerCase(),
      );
      if (matched) return matched.id;
    }
    return UNASSIGNED_CUBICLE_PHARMACIST;
  }, [item.pharmacistId, item.assignedPharmacist, pharmacists]);

  const [selectedValue, setSelectedValue] = useState<string>(resolvedInitialSelection);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const clearStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedValueRef = useRef<string>(resolvedInitialSelection);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Lista de opciones: profesionales activos de la sede + el asignado actual si aplica
  const selectablePharmacists = useMemo(() => {
    const active = pharmacists.filter(
      (p) => p.status === PharmacistStatus.ACTIVE || p.id === selectedValue || p.id === item.pharmacistId,
    );
    return active;
  }, [pharmacists, selectedValue, item.pharmacistId]);

  useEffect(() => {
    if (saveStatus !== 'saving' && saveStatus !== 'error') {
      setSelectedValue(resolvedInitialSelection);
      lastSavedValueRef.current = resolvedInitialSelection;
    }
  }, [resolvedInitialSelection, saveStatus]);

  const executeAssign = useCallback(
    async (nextSelection: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const pharmacistId =
        nextSelection === UNASSIGNED_CUBICLE_PHARMACIST ? null : nextSelection;
      const chosenPharmacist = pharmacistId
        ? pharmacists.find((p) => p.id === pharmacistId)
        : undefined;
      const operatorName = chosenPharmacist?.fullName ?? '';

      setSaveStatus('saving');
      try {
        await onAssignPharmacist(item.id, pharmacistId, operatorName, controller.signal);

        if (controller.signal.aborted) return;

        lastSavedValueRef.current = nextSelection;
        setSaveStatus('saved');

        if (clearStatusTimerRef.current) clearTimeout(clearStatusTimerRef.current);
        clearStatusTimerRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch {
        if (controller.signal.aborted) return;
        setSaveStatus('error');
      }
    },
    [item.id, onAssignPharmacist, pharmacists],
  );

  const handleSelectChange = (nextVal: string) => {
    setSelectedValue(nextVal);
    if (nextVal !== lastSavedValueRef.current) {
      void executeAssign(nextVal);
    }
  };

  useEffect(() => {
    return () => {
      if (clearStatusTimerRef.current) clearTimeout(clearStatusTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const currentPharmacist = pharmacists.find((p) => p.id === selectedValue);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
      {/* 1. Cabecera de Tarjeta */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${
                item.isEnabled ? 'bg-[#2c73d2] text-white' : 'bg-slate-100 text-slate-600'
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
            className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
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
            <Select.Root value={selectedValue} onValueChange={handleSelectChange}>
              <Select.Trigger
                id={`operator-${item.id}`}
                aria-label={`Farmacéutico Asignado para ${item.name}`}
                placeholder="Sin farmacéutico asignado"
                className="w-full bg-white"
              />
              <Select.Content>
                <Select.Item value={UNASSIGNED_CUBICLE_PHARMACIST}>
                  Sin farmacéutico asignado
                </Select.Item>
                {selectablePharmacists.map((pharmacist) => (
                  <Select.Item key={pharmacist.id} value={pharmacist.id}>
                    {`${pharmacist.fullName} (${pharmacist.licenseNumber} · ${PHARMACIST_ROLE_SHORT_LABELS_ES[pharmacist.operationalRole]})`}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            {currentPharmacist && (
              <p className="text-[11px] font-mono text-slate-600 mt-1">
                Matrícula {currentPharmacist.licenseNumber} ·{' '}
                {PHARMACIST_ROLE_SHORT_LABELS_ES[currentPharmacist.operationalRole]}
              </p>
            )}

            {/* Estado de guardado accesible (WCAG 4.1.3 Nivel AA) */}
            <div
              role="status"
              aria-live="polite"
              className="min-h-[24px] text-[11px] flex items-center gap-1.5 mt-1.5"
            >
              {saveStatus === 'saving' && (
                <span className="text-[#0f172a] flex items-center gap-1 font-medium">
                  <RefreshCw className="w-3 h-3 text-[#008e9b] motion-safe:animate-spin" aria-hidden="true" />
                  Guardando…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[#0f172a] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-[#008f7a]" aria-hidden="true" />
                  Guardado
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-700 flex items-center gap-1 font-medium">
                  <span>Error al guardar</span>
                  <button
                    type="button"
                    onClick={() => void executeAssign(selectedValue)}
                    className="inline-flex items-center min-h-[32px] px-2 rounded text-xs text-[#0f172a] underline font-semibold ml-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2]"
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
              {item.slaThresholdMinutes > 0 ? `${item.slaThresholdMinutes} min` : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-700 font-medium">Turnos atendidos hoy:</span>
            <span className="font-mono font-bold text-[#0f172a]">
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
            onClick={() => void onToggleStatus(item.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-lg border border-slate-500 bg-white hover:bg-red-50 hover:border-red-400 text-red-700 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2] focus-visible:ring-offset-2"
          >
            <Power className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
            Desactivar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onToggleStatus(item.id)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 min-h-[36px] rounded-lg bg-[#2c73d2] hover:shadow-[inset_0_0_0_100vmax_rgba(2,6,23,0.14)] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2] focus-visible:ring-offset-2"
          >
            <Power className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            Habilitar
          </button>
        )}
      </div>
    </div>
  );
};
