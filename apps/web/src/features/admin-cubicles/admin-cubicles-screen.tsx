// ─── [SCR-ADM-002] Administración · Configuración de Cubículos ──────────────
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Users, AlertTriangle } from 'lucide-react';
import { Badge, Callout } from '@radix-ui/themes';
import {
  CubicleStatus,
  PharmacistOperationalRole,
  PharmacistStatus,
  WorkShift,
  type AdminCubicleConfigDto,
} from '@cubiora/shared';
import { useOperationalTelemetry } from '../admin-overview/use-operational-telemetry';
import { useFacilitiesQuery } from '../admin-facilities/api';
import { usePharmacistsQuery } from '../admin-pharmacists/api';
import {
  useAdminCubiclesQuery,
  useAssignCubiclePharmacistMutation,
  useUpdateAdminCubicleStatusMutation,
} from './api';
import { CubicleConfigCard } from './cubicle-config-card';
import type {
  CubicleConfigurationItem,
  CubicleBadgeCode,
  PharmacistSelectOption,
} from './types';
import type { CubicleStation } from '../admin-overview/types';

const INITIAL_CUBICLES: CubicleConfigurationItem[] = [
  {
    id: 'CUB-01',
    code: 'CUB-01',
    numberCode: '01',
    name: 'Cubículo 01',
    moduleLabel: 'Módulo MOD-A',
    badgeStatus: 'BUSY',
    assignedPharmacist: 'Lic. M. Arismendi',
    pharmacistId: 'pharm-cub-01',
    pharmacistLicenseNumber: 'MN-3914',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 38,
    isEnabled: true,
  },
  {
    id: 'CUB-02',
    code: 'CUB-02',
    numberCode: '02',
    name: 'Cubículo 02',
    moduleLabel: 'Módulo MOD-A',
    badgeStatus: 'EXCEEDED',
    assignedPharmacist: 'Farm. J. Duarte',
    pharmacistId: 'pharm-cub-02',
    pharmacistLicenseNumber: 'MP-8921',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 34,
    isEnabled: true,
  },
  {
    id: 'CUB-03',
    code: 'CUB-03',
    numberCode: '03',
    name: 'Cubículo 03',
    moduleLabel: 'Módulo MOD-B',
    badgeStatus: 'CALLING',
    assignedPharmacist: 'Lic. R. Mendoza',
    pharmacistId: 'pharm-cub-03',
    pharmacistLicenseNumber: 'MN-4812',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 41,
    isEnabled: true,
  },
  {
    id: 'CUB-04',
    code: 'CUB-04',
    numberCode: '04',
    name: 'Cubículo 04',
    moduleLabel: 'Módulo MOD-B',
    badgeStatus: 'AVAILABLE',
    assignedPharmacist: 'Farm. S. Quintero',
    pharmacistId: 'pharm-cub-04',
    pharmacistLicenseNumber: 'MN-7230',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 35,
    isEnabled: true,
  },
  {
    id: 'CUB-05',
    code: 'CUB-05',
    numberCode: '05',
    name: 'Cubículo 05',
    moduleLabel: 'Módulo MOD-C',
    badgeStatus: 'INACTIVE',
    assignedPharmacist: 'Farm. Auxiliar Guardia',
    pharmacistId: 'pharm-cub-05',
    pharmacistLicenseNumber: 'MN-0042',
    slaThresholdMinutes: 12,
    dailyProcessedCount: 0,
    isEnabled: false,
  },
];

const FALLBACK_PHARMACISTS: PharmacistSelectOption[] = [
  {
    id: 'pharm-cub-01',
    fullName: 'Lic. M. Arismendi',
    licenseNumber: 'MN-3914',
    operationalRole: PharmacistOperationalRole.TITULAR,
    shift: WorkShift.MORNING,
    status: PharmacistStatus.ACTIVE,
    facilityId: null,
  },
  {
    id: 'pharm-cub-02',
    fullName: 'Farm. J. Duarte',
    licenseNumber: 'MP-8921',
    operationalRole: PharmacistOperationalRole.ADJUNTO,
    shift: WorkShift.AFTERNOON,
    status: PharmacistStatus.ACTIVE,
    facilityId: null,
  },
  {
    id: 'pharm-cub-03',
    fullName: 'Lic. R. Mendoza',
    licenseNumber: 'MN-4812',
    operationalRole: PharmacistOperationalRole.TITULAR,
    shift: WorkShift.MORNING,
    status: PharmacistStatus.ACTIVE,
    facilityId: null,
  },
  {
    id: 'pharm-cub-04',
    fullName: 'Farm. S. Quintero',
    licenseNumber: 'MN-7230',
    operationalRole: PharmacistOperationalRole.DISPENSADOR,
    shift: WorkShift.ROTATING,
    status: PharmacistStatus.ACTIVE,
    facilityId: null,
  },
  {
    id: 'pharm-cub-05',
    fullName: 'Farm. Auxiliar Guardia',
    licenseNumber: 'MN-0042',
    operationalRole: PharmacistOperationalRole.GUARDIA,
    shift: WorkShift.ROTATING,
    status: PharmacistStatus.ACTIVE,
    facilityId: null,
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

function mapAdminCubicleDtoToItem(dto: AdminCubicleConfigDto): CubicleConfigurationItem {
  const digits = dto.code.match(/\d+/)?.[0] ?? dto.displayName.match(/\d+/)?.[0] ?? dto.id;
  const numberCode = digits.padStart(2, '0');
  const numVal = Number.parseInt(digits, 10);
  const moduleCode = numVal <= 2 ? 'MOD-A' : numVal <= 4 ? 'MOD-B' : 'MOD-C';

  let badgeStatus: CubicleBadgeCode = 'AVAILABLE';
  if (!dto.active || dto.status === CubicleStatus.INACTIVE) {
    badgeStatus = 'INACTIVE';
  } else if (dto.status === CubicleStatus.BUSY) {
    badgeStatus = 'BUSY';
  } else if (dto.status === CubicleStatus.CALLING) {
    badgeStatus = 'CALLING';
  }

  return {
    id: dto.id,
    code: dto.code,
    numberCode,
    name: dto.displayName,
    moduleLabel: `Módulo ${moduleCode}`,
    badgeStatus,
    assignedPharmacist: dto.pharmacistName ?? dto.operatorName ?? '',
    pharmacistId: dto.pharmacistId ?? null,
    pharmacistLicenseNumber: dto.pharmacistLicenseNumber ?? null,
    facilityId: dto.facilityId,
    facilityCode: dto.facilityCode,
    facilityName: dto.facilityName,
    slaThresholdMinutes: Math.max(1, Math.round((dto.slaThresholdSeconds || 720) / 60)),
    dailyProcessedCount: dto.dailyCompletedCount ?? 0,
    isEnabled: dto.active && dto.status !== CubicleStatus.INACTIVE,
  };
}

export const AdminCubiclesScreen: React.FC = () => {
  const [cubicles, setCubicles] = useState<CubicleConfigurationItem[]>(INITIAL_CUBICLES);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const manuallyToggledIds = useRef<Set<string>>(new Set());

  const facilitiesQuery = useFacilitiesQuery({ retry: false });
  const facilities = useMemo(
    () => (Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : []),
    [facilitiesQuery.data],
  );
  const activeFacility = useMemo(
    () => facilities.find((f) => f.isPrimary) ?? facilities[0] ?? null,
    [facilities],
  );

  const adminCubiclesQuery = useAdminCubiclesQuery(activeFacility?.id, { retry: false });
  const pharmacistsQuery = usePharmacistsQuery(
    activeFacility?.id ? { facilityId: activeFacility.id } : {},
    { retry: false },
  );

  const assignMutation = useAssignCubiclePharmacistMutation();
  const statusMutation = useUpdateAdminCubicleStatusMutation();

  const selectablePharmacists: PharmacistSelectOption[] = useMemo(() => {
    const serverItems = pharmacistsQuery.data?.items;
    if (Array.isArray(serverItems) && serverItems.length > 0) {
      return serverItems.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        licenseNumber: p.licenseNumber,
        operationalRole: p.operationalRole,
        shift: p.shift,
        status: p.status,
        facilityId: p.facilityId,
      }));
    }
    return FALLBACK_PHARMACISTS;
  }, [pharmacistsQuery.data]);

  // Hidratar desde API cuando llegan los cubículos persistidos de la sede activa
  useEffect(() => {
    const serverCubicles = adminCubiclesQuery.data;
    if (!Array.isArray(serverCubicles) || serverCubicles.length === 0) return;

    setCubicles(serverCubicles.map(mapAdminCubicleDtoToItem));
  }, [adminCubiclesQuery.data]);

  // Sincronización en vivo con telemetría operativa WebSocket
  const { cubicles: telemetryStations } = useOperationalTelemetry(true);

  useEffect(() => {
    if (!telemetryStations || telemetryStations.length === 0) return;

    setCubicles((prev) => {
      const updated = prev.map((item) => {
        const live = telemetryStations.find(
          (s: CubicleStation) => s.id === item.id || (item.code && s.id === item.code),
        );
        if (!live) return item;

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
            live.operatorName !== null && live.operatorName !== undefined
              ? live.operatorName
              : item.assignedPharmacist,
        };
      });

      return updated;
    });
  }, [telemetryStations]);

  const handleAssignPharmacist = async (
    cubicleId: string,
    pharmacistId: string | null,
    operatorName: string,
    signal?: AbortSignal,
  ) => {
    try {
      const updated = await assignMutation.mutateAsync({
        cubicleId,
        dto: { pharmacistId, operatorName },
        signal,
      });

      setCubicles((prev) =>
        prev.map((c) => {
          if (c.id !== cubicleId) {
            // Si el farmacéutico fue reasignado desde otro cubículo, lo desasignamos allí también en estado local
            if (pharmacistId && c.pharmacistId === pharmacistId) {
              return {
                ...c,
                pharmacistId: null,
                pharmacistLicenseNumber: null,
                assignedPharmacist: '',
              };
            }
            return c;
          }
          if (updated && typeof updated === 'object' && 'displayName' in updated) {
            return mapAdminCubicleDtoToItem(updated);
          }
          return {
            ...c,
            pharmacistId,
            assignedPharmacist: operatorName,
          };
        }),
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      throw err;
    }
  };

  const handleToggleStatus = async (id: string) => {
    setToggleError(null);
    const target = cubicles.find((c) => c.id === id);
    if (!target) return;

    const nextEnabled = !target.isEnabled;
    manuallyToggledIds.current.add(id);

    setCubicles((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              isEnabled: nextEnabled,
              badgeStatus: nextEnabled ? 'AVAILABLE' : 'INACTIVE',
            }
          : c,
      ),
    );

    try {
      await statusMutation.mutateAsync({ cubicleId: id, active: nextEnabled });
    } catch (err: unknown) {
      // Revertir únicamente en errores de negocio HTTP (ej. 409 turno activo en curso)
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: unknown }).statusCode)
          : 0;
      if (statusCode >= 400 && statusCode < 500) {
        const message =
          err instanceof Error
            ? err.message
            : 'No fue posible actualizar el estado del cubículo.';
        setCubicles((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  isEnabled: target.isEnabled,
                  badgeStatus: target.badgeStatus,
                }
              : c,
          ),
        );
        setToggleError(message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-8 space-y-5">
      {/* ═══════════════ HEADER SUPERIOR DE PÁGINA ═══════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Izquierda: Breadcrumbs y Título Principal */}
        <div>
          <div className="flex items-center text-xs flex-wrap gap-1.5">
            <span className="font-mono font-bold text-blue-700">SCR-ADM-002</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">Parametrización de Puestos y Ventanillas</span>
            <span className="sr-only">SCR-ADM-002 · Administración</span>
            {activeFacility && (
              <Badge size="1" variant="soft" color="teal">
                <Building2 size={11} aria-hidden="true" />
                {activeFacility.name} ({activeFacility.code})
              </Badge>
            )}
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

        {/* Derecha: Enlaces a Directorio de Farmacéuticos, Sedes y Panel General */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/admin/farmaceuticos"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Users size={13} aria-hidden="true" />
            Directorio de Farmacéuticos
          </Link>
          <Link
            to="/admin/sedes"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Building2 size={13} aria-hidden="true" />
            Cambiar Sede
          </Link>
          <Link
            to="/admin"
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-2xs transition-colors inline-block"
          >
            ← Volver al Panel General
          </Link>
        </div>
      </div>

      {toggleError && (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertTriangle size={16} aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>{toggleError}</Callout.Text>
        </Callout.Root>
      )}

      {/* ═══════════════ GRILLA DE CONFIGURACIÓN DE CUBÍCULOS ═══════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {cubicles.map((cubicle) => (
          <CubicleConfigCard
            key={cubicle.id}
            item={cubicle}
            pharmacists={selectablePharmacists}
            onAssignPharmacist={handleAssignPharmacist}
            onToggleStatus={handleToggleStatus}
          />
        ))}
      </div>
    </div>
  );
};
