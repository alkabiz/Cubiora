import React, { useRef, useState } from 'react';
import { Dialog } from '@radix-ui/themes';
import {
  ExclamationTriangleIcon,
  ExitIcon,
  PersonIcon,
  ReloadIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import { useNavigate } from 'react-router-dom';
import { TicketStatus } from '@cubiora/shared';
import { useAuth } from '../context/auth-context';
import { MiCubiculo } from '../features/cashier/mi-cubiculo';
import { useCubicleWorkspace } from '../features/cashier/use-cubicle-workspace';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const workspace = useCubicleWorkspace({ cubicleCode: CUBICLE_CODE });
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const logoutBackButtonRef = useRef<HTMLButtonElement>(null);

  const isTurnInProgress =
    workspace.activeTicket !== null &&
    ACTIVE_TICKET_STATUSES.includes(workspace.activeTicket.status);

  const handleLogoutClick = async () => {
    if (isTurnInProgress) {
      setLogoutModalOpen(true);
      return;
    }

    await logout();
    navigate('/login', { replace: true });
  };

  const actionErrorIsConflict =
    workspace.actionError?.includes('otro operador o proceso concurrente') ?? false;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <header className="border-b border-[#E2E8F0] pb-4 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0F2942] text-white flex items-center justify-center font-extrabold text-sm">
              C
            </div>
            <span className="text-lg font-extrabold text-[#0F2942] tracking-tight">Cubiora</span>
            <span className="inline-flex items-center px-2 py-1 rounded bg-[#EFF4FF] border border-[#C9E6FF] text-[#006591] text-[11px] font-bold uppercase tracking-wider">
              Caja
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569]">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  workspace.isOnline ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                }`}
                aria-hidden="true"
              />
              {workspace.isOnline ? 'En línea' : 'Sin conexión'}
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#0F2942]">
              <PersonIcon className="w-3.5 h-3.5 text-[#64748B]" aria-hidden="true" />
              {user?.displayName || user?.username || 'Cajero'}
            </span>

            <button
              id="btn-logout-cashier"
              type="button"
              onClick={() => void handleLogoutClick()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
            >
              <ExitIcon className="w-3.5 h-3.5" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </div>

        {workspace.actionError && (
          <div
            role="alert"
            className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${
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
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-xs text-[#92400E]"
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
      </header>

      <MiCubiculo workspace={workspace} />

      <Dialog.Root open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <Dialog.Content
          size="2"
          className="max-w-[460px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-blocked-title"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            logoutBackButtonRef.current?.focus();
          }}
        >
          <Dialog.Title id="logout-blocked-title" className="text-base font-bold text-[#0F2942]">
            Turno activo en progreso
          </Dialog.Title>
          <Dialog.Description size="2" className="mt-2 text-[#475569]">
            No puedes cerrar sesión durante un turno activo. Finaliza la atención antes de salir.
          </Dialog.Description>

          <div className="mt-5 flex justify-end">
            <button
              ref={logoutBackButtonRef}
              type="button"
              onClick={() => setLogoutModalOpen(false)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F2942] hover:bg-[#0A1B2C] text-white font-bold text-xs transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
            >
              Volver al turno
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
};
