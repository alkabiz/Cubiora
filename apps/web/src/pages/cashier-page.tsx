import React from 'react';
import { ExclamationTriangleIcon, ReloadIcon, UpdateIcon } from '@radix-ui/react-icons';
import { TicketStatus } from '@cubiora/shared';
import { AppMain } from '../app/app-main';
import { PageHeader } from '../app/page-header';
import { useShellOperationalStatus } from '../app/shell-status-context';
import { CubicleDailyPerformanceCard } from '../features/cashier/cubicle-daily-performance-card';
import { MiCubiculo } from '../features/cashier/mi-cubiculo';
import { useCubicleWorkspace } from '../features/cashier/use-cubicle-workspace';
import { useAuth } from '../context/auth-context';

/**
 * Código del cubículo operado por esta estación.
 * Se configura por entorno para no asociar la pantalla a un cubículo fijo
 * cuando el despliegue tenga varias ventanillas.
 */
const CUBICLE_CODE = import.meta.env.VITE_CUBICLE_CODE?.trim() || 'CUB-03';

const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.ASSIGNED,
  TicketStatus.CALLED,
  TicketStatus.IN_SERVICE,
];

export const CashierPage: React.FC = () => {
  const { user } = useAuth();
  const workspace = useCubicleWorkspace({ cubicleCode: CUBICLE_CODE });
  const canViewPerformance = user?.role === 'CASHIER' || user?.role === 'ADMIN';

  const isTurnInProgress =
    workspace.activeTicket !== null &&
    ACTIVE_TICKET_STATUSES.includes(workspace.activeTicket.status);

  useShellOperationalStatus({
    online: workspace.isOnline,
    checking: workspace.isInitialLoading,
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
      {workspace.actionError && (
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

      {!workspace.actionError &&
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

      <div className="cashier-workspace-grid">
        <MiCubiculo workspace={workspace} />

        {canViewPerformance && (
          <CubicleDailyPerformanceCard
            cubicleCode={CUBICLE_CODE}
            outcome={workspace.outcome}
          />
        )}
      </div>
    </AppMain>
  );
};
