import React, { useMemo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Callout } from '@radix-ui/themes';
import { TicketStatus } from '@cubiora/shared';
import { AppMain } from '../app/app-main';
import { PageHeader } from '../app/page-header';
import { useShellOperationalStatus } from '../app/shell-status-context';
import { CubicleDailyPerformanceCard } from '../features/cashier/cubicle-daily-performance-card';
import { MiCubiculo } from '../features/cashier/mi-cubiculo';
import { useCubicleWorkspace } from '../features/cashier/use-cubicle-workspace';
import { useAuth } from '../context/auth-context';

const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.ASSIGNED,
  TicketStatus.CALLED,
  TicketStatus.IN_SERVICE,
];

export const CashierPage: React.FC = () => {
  const { user } = useAuth();
  const isCashier = user?.role === 'CASHIER';

  const activeCubicleCode = useMemo(() => {
    if (!isCashier || !user) return '';
    return (user.cubicleCode?.trim() || user.cubicleId?.trim() || '').trim();
  }, [isCashier, user]);

  const workspaceEnabled = Boolean(user) && Boolean(activeCubicleCode);

  const workspace = useCubicleWorkspace({
    cubicleCode: activeCubicleCode,
    enabled: workspaceEnabled,
  });

  const canViewPerformance = isCashier && workspaceEnabled;

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
          section="Operación"
          title="Mi cubículo"
          description="Gestiona el llamado, la atención y el cierre del turno actual."
        />
      }
    >
      {!user && (
        <Callout.Root color="gray" role="status">
          <Callout.Icon>
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>
            Inicia sesión con una cuenta de operador de cubículo o administrador para gestionar turnos.
          </Callout.Text>
        </Callout.Root>
      )}

      {isCashier && !activeCubicleCode && (
        <Callout.Root color="amber" role="alert">
          <Callout.Icon>
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>
            Esta cuenta no tiene un cubículo asignado. Solicita a un administrador vincular un cubículo operativo en Administración → Sedes y Usuarios antes de gestionar turnos.
          </Callout.Text>
        </Callout.Root>
      )}

      {user && !isCashier && (
        <Callout.Root color="gray" role="status">
          <Callout.Icon>
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>
            Esta vista operativa es exclusiva para cuentas con rol Operador de cubículo. Para supervisar ventanillas en tiempo real, accede al módulo de Administración.
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
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
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
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              No se pudo sincronizar el cubículo. Se conserva el último estado confirmado.
            </span>

            <button
              type="button"
              onClick={() => void workspace.refresh()}
              disabled={workspace.isRefreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded border border-amber-500 bg-white font-semibold text-[#92400E] hover:bg-[#FEF3C7] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2]"
            >
              <RefreshCw
                className={`w-3.5 h-3.5${workspace.isRefreshing ? ' motion-safe:animate-spin' : ''}`}
                aria-hidden="true"
              />
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
