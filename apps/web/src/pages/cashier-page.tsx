import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExclamationTriangleIcon, ReloadIcon, UpdateIcon } from '@radix-ui/react-icons';
import { Callout, Select } from '@radix-ui/themes';
import { TicketStatus, type CubicleOptionDto } from '@cubiora/shared';
import { AppMain } from '../app/app-main';
import { PageHeader } from '../app/page-header';
import { useShellOperationalStatus } from '../app/shell-status-context';
import { CubicleDailyPerformanceCard } from '../features/cashier/cubicle-daily-performance-card';
import { MiCubiculo } from '../features/cashier/mi-cubiculo';
import { useCubicleWorkspace } from '../features/cashier/use-cubicle-workspace';
import { useAuth } from '../context/auth-context';
import { apiClient, unwrapApiData, type WrappedApiResponse } from '../lib/api';

const ENV_PREFERRED_CUBICLE = import.meta.env.VITE_CUBICLE_CODE?.trim() || '';

const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.ASSIGNED,
  TicketStatus.CALLED,
  TicketStatus.IN_SERVICE,
];

export const CashierPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isCashier = user?.role === 'CASHIER';

  const [adminCubicles, setAdminCubicles] = useState<CubicleOptionDto[]>([]);
  const [selectedAdminCubicleCode, setSelectedAdminCubicleCode] = useState<string>('');
  const [loadingAdminCubicles, setLoadingAdminCubicles] = useState(false);
  const [adminCubiclesError, setAdminCubiclesError] = useState<string | null>(null);

  const loadAdminCubicles = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingAdminCubicles(true);
    setAdminCubiclesError(null);
    try {
      const response = await apiClient<WrappedApiResponse<CubicleOptionDto[]>>('/cubicles');
      const unwrapped = unwrapApiData(response);
      const list = Array.isArray(unwrapped) ? unwrapped : [];
      setAdminCubicles(list);

      setSelectedAdminCubicleCode((current) => {
        if (current && list.some((c) => c.code === current)) {
          return current;
        }
        const envMatch = ENV_PREFERRED_CUBICLE
          ? list.find((c) => c.code === ENV_PREFERRED_CUBICLE && c.active)
          : undefined;
        const preferred = envMatch ?? list.find((c) => c.active) ?? list[0];
        return preferred?.code ?? '';
      });
    } catch (error) {
      setAdminCubicles([]);
      setAdminCubiclesError(
        error instanceof Error
          ? error.message
          : 'No fue posible cargar la lista de cubículos disponibles.',
      );
    } finally {
      setLoadingAdminCubicles(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void loadAdminCubicles();
    } else {
      setAdminCubicles([]);
      setSelectedAdminCubicleCode('');
      setAdminCubiclesError(null);
      setLoadingAdminCubicles(false);
    }
  }, [isAdmin, loadAdminCubicles]);

  const cashierAssignedCubicle = useMemo(() => {
    if (!isCashier || !user) return '';
    return (user.cubicleCode?.trim() || user.cubicleId?.trim() || '').trim();
  }, [isCashier, user]);

  const activeCubicleCode = isAdmin
    ? selectedAdminCubicleCode
    : isCashier
      ? cashierAssignedCubicle
      : '';

  const workspaceEnabled = Boolean(user) && Boolean(activeCubicleCode);

  const workspace = useCubicleWorkspace({
    cubicleCode: activeCubicleCode,
    enabled: workspaceEnabled,
  });

  const canViewPerformance = (isCashier || isAdmin) && workspaceEnabled;

  const isTurnInProgress =
    workspaceEnabled &&
    workspace.activeTicket !== null &&
    ACTIVE_TICKET_STATUSES.includes(workspace.activeTicket.status);

  useShellOperationalStatus({
    online: workspaceEnabled ? workspace.isOnline : true,
    checking: workspaceEnabled ? workspace.isInitialLoading : false,
    logoutBlocked: isTurnInProgress,
  });

  const actionErrorIsConflict =
    workspace.actionError?.includes('otro operador o proceso concurrente') ?? false;

  return (
    <AppMain
      header={
        <PageHeader
          code="SCR-CAJ-001"
          section="Operación"
          title="Mi cubículo"
          description="Gestiona el llamado, la atención y el cierre del turno actual."
        />
      }
    >
      {!user && (
        <Callout.Root color="gray" role="status">
          <Callout.Icon>
            <ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>
            Inicia sesión con una cuenta de operador de cubículo o administrador para gestionar turnos.
          </Callout.Text>
        </Callout.Root>
      )}

      {isCashier && !cashierAssignedCubicle && (
        <Callout.Root color="amber" role="alert">
          <Callout.Icon>
            <ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>
            Esta cuenta no tiene un cubículo asignado. Solicita a un administrador vincular un cubículo operativo en Administración → Sedes y Usuarios antes de gestionar turnos.
          </Callout.Text>
        </Callout.Root>
      )}

      {isAdmin && (
        <section
          aria-label="Selector de cubículo operativo"
          className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs"
        >
          <div>
            <p className="text-xs font-bold text-[#0F2942]">
              Vista de supervisión · Selección de cubículo
            </p>
            <p className="text-xs text-slate-600">
              Selecciona la ventanilla que deseas inspeccionar u operar en tiempo real.
            </p>
          </div>

          {adminCubicles.length > 0 && (
            <div className="flex items-center gap-2 min-w-[260px]">
              <label
                htmlFor="admin-cubicle-select"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                Cubículo:
              </label>
              <Select.Root
                value={selectedAdminCubicleCode}
                onValueChange={setSelectedAdminCubicleCode}
              >
                <Select.Trigger
                  id="admin-cubicle-select"
                  aria-label="Seleccionar cubículo operativo"
                  placeholder="Selecciona un cubículo"
                  className="w-full"
                />
                <Select.Content>
                  {adminCubicles.map((cub) => (
                    <Select.Item key={cub.id} value={cub.code}>
                      {`${cub.displayName} (${cub.code})${cub.facilityCode ? ` · ${cub.facilityCode}` : ''}${!cub.active ? ' [Inactivo]' : ''}`}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
          )}
        </section>
      )}

      {isAdmin && loadingAdminCubicles && adminCubicles.length === 0 && (
        <Callout.Root color="blue" role="status">
          <Callout.Icon>
            <UpdateIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>Cargando cubículos disponibles…</Callout.Text>
        </Callout.Root>
      )}

      {isAdmin && adminCubiclesError && (
        <Callout.Root color="red" role="alert" mb="4">
          <Callout.Icon>
            <ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" />
          </Callout.Icon>
          <div className="flex items-center justify-between gap-3 flex-wrap w-full">
            <Callout.Text>{adminCubiclesError}</Callout.Text>
            <button
              type="button"
              onClick={() => void loadAdminCubicles()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-300 bg-white text-xs font-semibold text-red-800 hover:bg-red-50 cursor-pointer"
            >
              <ReloadIcon className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        </Callout.Root>
      )}

      {isAdmin &&
        !loadingAdminCubicles &&
        !adminCubiclesError &&
        adminCubicles.length === 0 && (
          <Callout.Root color="amber" role="status">
            <Callout.Icon>
              <ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" />
            </Callout.Icon>
            <Callout.Text>
              No existen cubículos registrados en el sistema para seleccionar.
            </Callout.Text>
          </Callout.Root>
        )}

      {workspaceEnabled && workspace.actionError && (
        <div
          role="alert"
          className={`flex items-start gap-2 p-3 rounded-lg border text-xs mb-4 ${
            actionErrorIsConflict
              ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="font-medium leading-relaxed">{workspace.actionError}</span>
        </div>
      )}

      {workspaceEnabled &&
        !workspace.actionError &&
        workspace.isOnline &&
        workspace.syncError &&
        workspace.snapshot && (
          <div
            role="status"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 mb-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-xs text-[#92400E]"
          >
            <span className="flex items-start gap-2 font-medium leading-relaxed">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              No se pudo sincronizar el cubículo. Se conserva el último estado confirmado.
            </span>

            <button
              type="button"
              onClick={() => void workspace.refresh()}
              disabled={workspace.isRefreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-[#FDE68A] bg-white font-semibold text-[#92400E] hover:bg-[#FEF3C7] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {workspace.isRefreshing ? (
                <UpdateIcon className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ReloadIcon className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Reintentar
            </button>
          </div>
        )}

      {workspaceEnabled && (
        <div className="cashier-workspace-grid">
          <MiCubiculo workspace={workspace} />

          {canViewPerformance && (
            <CubicleDailyPerformanceCard
              cubicleCode={activeCubicleCode}
              outcome={workspace.outcome}
            />
          )}
        </div>
      )}
    </AppMain>
  );
};
