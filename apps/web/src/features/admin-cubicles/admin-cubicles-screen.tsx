// ─── [SCR-ADM-002] Administración · Configuración de Cubículos ──────────────
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge, Callout, Select } from '@radix-ui/themes';
import { AppMain } from '../../app/app-main';
import { PageHeader } from '../../app/page-header';
import {
  CubicleStatus,
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
    slaThresholdMinutes:
      typeof dto.slaThresholdSeconds === 'number' && dto.slaThresholdSeconds > 0
        ? Math.max(1, Math.round(dto.slaThresholdSeconds / 60))
        : 0,
    dailyProcessedCount: dto.dailyCompletedCount ?? 0,
    isEnabled: dto.active && dto.status !== CubicleStatus.INACTIVE,
  };
}

export const AdminCubiclesScreen: React.FC = () => {
  const [cubicles, setCubicles] = useState<CubicleConfigurationItem[]>([]);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const manuallyToggledIds = useRef<Set<string>>(new Set());

  const facilitiesQuery = useFacilitiesQuery({ retry: false });
  const facilities = useMemo(
    () => (Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : []),
    [facilitiesQuery.data],
  );

  useEffect(() => {
    if (facilities.length === 0) {
      setSelectedFacilityId(null);
      return;
    }
    setSelectedFacilityId((current) => {
      if (current && facilities.some((f) => f.id === current)) {
        return current;
      }
      const primary = facilities.find((f) => f.isPrimary) ?? facilities[0] ?? null;
      return primary?.id ?? null;
    });
  }, [facilities]);

  const activeFacility = useMemo(
    () =>
      facilities.find((f) => f.id === selectedFacilityId) ??
      facilities.find((f) => f.isPrimary) ??
      facilities[0] ??
      null,
    [facilities, selectedFacilityId],
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
    if (Array.isArray(serverItems)) {
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
    return [];
  }, [pharmacistsQuery.data]);

  // Hidratar desde API cuando llegan los cubículos persistidos de la sede seleccionada
  useEffect(() => {
    const serverCubicles = adminCubiclesQuery.data;
    if (Array.isArray(serverCubicles)) {
      setCubicles(serverCubicles.map(mapAdminCubicleDtoToItem));
    } else if (adminCubiclesQuery.isLoading) {
      setCubicles([]);
    }
  }, [adminCubiclesQuery.data, adminCubiclesQuery.isLoading]);

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

  const isLoading = adminCubiclesQuery.isLoading && cubicles.length === 0;
  const hasLoadError =
    adminCubiclesQuery.isError || facilitiesQuery.isError || pharmacistsQuery.isError;

  const handleRetryLoad = () => {
    void facilitiesQuery.refetch();
    void adminCubiclesQuery.refetch();
    void pharmacistsQuery.refetch();
  };

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {facilities.length > 1 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="admin-cubicles-facility-select"
            className="text-xs font-semibold text-slate-700 whitespace-nowrap"
          >
            Sede:
          </label>
          <Select.Root
            value={activeFacility?.id ?? ''}
            onValueChange={(value) => {
              manuallyToggledIds.current.clear();
              setSelectedFacilityId(value);
            }}
          >
            <Select.Trigger
              id="admin-cubicles-facility-select"
              aria-label="Seleccionar sede hospitalaria"
              className="bg-white min-w-[230px]"
            />
            <Select.Content>
              {facilities.map((fac) => (
                <Select.Item key={fac.id} value={fac.id}>
                  {`${fac.name} (${fac.code})${fac.isPrimary ? ' · Primaria' : ''}`}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      )}
      <Link
        to="/admin/farmaceuticos"
        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-500 rounded-lg px-3.5 py-2 min-h-[36px] text-xs font-semibold shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2"
      >
        <Users size={13} aria-hidden="true" />
        Directorio de Farmacéuticos
      </Link>
      <Link
        to="/admin/sedes"
        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-500 rounded-lg px-3.5 py-2 min-h-[36px] text-xs font-semibold shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2"
      >
        <Building2 size={13} aria-hidden="true" />
        Cambiar Sede
      </Link>
      <Link
        to="/admin"
        className="inline-flex items-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-500 rounded-lg px-3.5 py-2 min-h-[36px] text-xs font-semibold shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2"
      >
        ← Volver al Panel General
      </Link>
    </div>
  );

  return (
    <AppMain
      header={
        <PageHeader
          section="Administración · Parametrización de Puestos"
          eyebrowBadge={
            activeFacility ? (
              <Badge size="1" variant="soft" color="teal">
                <Building2 size={11} aria-hidden="true" />
                {activeFacility.name} ({activeFacility.code})
              </Badge>
            ) : undefined
          }
          backTo="/admin"
          backLabel="Volver al panel general"
          title="Configuración de Cubículos"
          action={headerActions}
        />
      }
    >
      <div className="space-y-5">

      {hasLoadError && (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertTriangle size={16} aria-hidden="true" />
          </Callout.Icon>
          <div className="flex items-center justify-between gap-3 flex-wrap w-full">
            <Callout.Text>
              No fue posible cargar la configuración de cubículos o farmacéuticos desde el servidor.
            </Callout.Text>
            <button
              type="button"
              onClick={handleRetryLoad}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded-lg bg-white border border-red-300 text-red-800 hover:bg-red-50 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        </Callout.Root>
      )}

      {toggleError && (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertTriangle size={16} aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>{toggleError}</Callout.Text>
        </Callout.Root>
      )}

      {/* ═══════════════ GRILLA DE CONFIGURACIÓN DE CUBÍCULOS ═══════════════ */}
      {isLoading ? (
        <div
          role="status"
          className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-sm text-slate-600"
        >
          Cargando configuración de cubículos...
        </div>
      ) : !adminCubiclesQuery.isError && cubicles.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-sm text-slate-600">
          No hay cubículos registrados para la sede seleccionada.
        </div>
      ) : (
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
      )}
      </div>
    </AppMain>
  );
};
