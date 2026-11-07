// ─── [SCR-ADM-002] Administración · Configuración de Cubículos ──────────────
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useOperationalTelemetry } from '../admin-overview/use-operational-telemetry';
import { CubicleConfigCard } from './cubicle-config-card';
import { apiClient } from '../../lib/api';
import type { CubicleConfigurationItem, CubicleBadgeCode } from './types';
import type { CubicleStation } from '../admin-overview/types';

const INITIAL_CUBICLES: CubicleConfigurationItem[] = [
  {
    id: 'CUB-01',
    numberCode: '01',
    name: 'Cubículo 01',
    moduleLabel: 'Módulo MOD-A',
    badgeStatus: 'BUSY',
    assignedPharmacist: 'Lic. M. Arismendi',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 38,
    isEnabled: true,
  },
  {
    id: 'CUB-02',
    numberCode: '02',
    name: 'Cubículo 02',
    moduleLabel: 'Módulo MOD-A',
    badgeStatus: 'EXCEEDED',
    assignedPharmacist: 'Farm. J. Duarte',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 34,
    isEnabled: true,
  },
  {
    id: 'CUB-03',
    numberCode: '03',
    name: 'Cubículo 03',
    moduleLabel: 'Módulo MOD-B',
    badgeStatus: 'CALLING',
    assignedPharmacist: 'Lic. R. Mendoza',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 41,
    isEnabled: true,
  },
  {
    id: 'CUB-04',
    numberCode: '04',
    name: 'Cubículo 04',
    moduleLabel: 'Módulo MOD-B',
    badgeStatus: 'AVAILABLE',
    assignedPharmacist: 'Farm. S. Quintero',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 35,
    isEnabled: true,
  },
  {
    id: 'CUB-05',
    numberCode: '05',
    name: 'Cubículo 05',
    moduleLabel: 'Módulo MOD-C',
    badgeStatus: 'INACTIVE',
    assignedPharmacist: 'Farm. Auxiliar Guardia',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 0,
    isEnabled: false,
  },
];

function mapTelemetryStatusToBadge(status: string): CubicleBadgeCode {
  switch (status) {
    case 'ATENDIENDO':
      return 'BUSY';
    case 'SLA_EXCEDIDO':
      return 'EXCEEDED';
    case 'LLAMANDO':
      return 'CALLING';
    case 'DISPONIBLE':
      return 'AVAILABLE';
    case 'INACTIVO':
    default:
      return 'INACTIVE';
  }
}

export const AdminCubiclesScreen: React.FC = () => {
  const [cubicles, setCubicles] = useState<CubicleConfigurationItem[]>(INITIAL_CUBICLES);
  const manuallyToggledIds = useRef<Set<string>>(new Set());

  // Sincronización en vivo con telemetría operativa
  const { cubicles: telemetryStations } = useOperationalTelemetry(true);

  useEffect(() => {
    if (!telemetryStations || telemetryStations.length === 0) return;

    setCubicles((prev) => {
      const updated = prev.map((item) => {
        const live = telemetryStations.find((s: CubicleStation) => s.id === item.id);
        if (!live) return item;

        // Si el usuario conmutó manualmente este cubículo, respetamos su estado
        if (manuallyToggledIds.current.has(item.id)) {
          return {
            ...item,
            dailyProcessedCount:
              live.dailyProcessedCount > 0 ? live.dailyProcessedCount : item.dailyProcessedCount,
          };
        }

        const liveBadge = mapTelemetryStatusToBadge(live.status);
        const isEnabled = liveBadge !== 'INACTIVE';

        return {
          ...item,
          badgeStatus: liveBadge,
          isEnabled,
          dailyProcessedCount:
            live.dailyProcessedCount > 0 ? live.dailyProcessedCount : item.dailyProcessedCount,
          assignedPharmacist:
            item.assignedPharmacist || live.operatorName || 'Operador en Ventanilla',
        };
      });

      const existingIds = new Set(prev.map((c) => c.id));
      const extraItems: CubicleConfigurationItem[] = [];

      for (const station of telemetryStations) {
        if (!existingIds.has(station.id)) {
          const liveBadge = mapTelemetryStatusToBadge(station.status);
          const digits = station.name?.match(/\d+/)?.[0] ?? station.id.replace(/\D/g, '');
          const numberCode = digits ? digits.padStart(2, '0') : station.id;
          extraItems.push({
            id: station.id,
            numberCode,
            name: station.name || `Cubículo ${numberCode}`,
            moduleLabel: station.moduleCode ? `Módulo ${station.moduleCode}` : 'Módulo General',
            badgeStatus: liveBadge,
            assignedPharmacist: station.operatorName || 'Operador en Ventanilla',
            slaThresholdMinutes: 12,
            dailyProcessedCount: station.dailyProcessedCount || 0,
            isEnabled: liveBadge !== 'INACTIVE',
          });
        }
      }

      return extraItems.length > 0 ? [...updated, ...extraItems] : updated;
    });
  }, [telemetryStations]);

  const handleUpdatePharmacist = async (id: string, name: string, signal?: AbortSignal) => {
    try {
      await apiClient(`/cubicles/${encodeURIComponent(id)}/operator`, {
        method: 'PATCH',
        body: JSON.stringify({ operatorName: name }),
        signal,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      throw err;
    }

    setCubicles((prev) =>
      prev.map((c) => (c.id === id ? { ...c, assignedPharmacist: name } : c)),
    );
  };

  const handleToggleStatus = (id: string) => {
    manuallyToggledIds.current.add(id);

    setCubicles((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.isEnabled) {
          // Desactivar: pasa a 'INACTIVE', isEnabled = false
          return {
            ...c,
            isEnabled: false,
            badgeStatus: 'INACTIVE',
          };
        } else {
          // Habilitar: pasa a 'AVAILABLE', isEnabled = true
          return {
            ...c,
            isEnabled: true,
            badgeStatus: 'AVAILABLE',
          };
        }
      }),
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-8">
      {/* ═══════════════ HEADER SUPERIOR DE PÁGINA ═══════════════ */}
      <div className="flex items-center justify-between mb-6">
        {/* Izquierda: Breadcrumbs y Título Principal */}
        <div>
          <div className="flex items-center text-xs">
            <span className="font-mono font-bold text-blue-700">SCR-ADM-002</span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-500">Parametrización de Puestos y Ventanillas</span>
            <span className="sr-only">SCR-ADM-002 · Administración</span>
          </div>

          <div className="flex items-center gap-2.5 mt-1">
            <Link
              to="/admin"
              aria-label="Volver al panel general"
              className="text-blue-800 hover:text-blue-950 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              [SCR-ADM-002] Administración · Configuración de Cubículos
            </h1>
            <h2 className="sr-only">Cubículos</h2>
          </div>
        </div>

        {/* Derecha: Botón secundario para volver al Panel General */}
        <div>
          <Link
            to="/admin"
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-2xs transition-colors inline-block"
          >
            ← Volver al Panel General
          </Link>
        </div>
      </div>

      {/* ═══════════════ GRILLA DE CONFIGURACIÓN DE CUBÍCULOS ═══════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {cubicles.map((cubicle) => (
          <CubicleConfigCard
            key={cubicle.id}
            item={cubicle}
            onUpdatePharmacist={handleUpdatePharmacist}
            onToggleStatus={handleToggleStatus}
          />
        ))}
      </div>
    </div>
  );
};
