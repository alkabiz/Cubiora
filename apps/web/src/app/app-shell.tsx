import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dialog, VisuallyHidden } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useAuth } from '../context/auth-context';
import { AppNavbar } from './app-navbar';
import { AppSidebar } from './app-sidebar';
import {
  ShellStatusProvider,
  useShellStatus,
  type ConnectionStatus,
} from './shell-status-context';

function getBrowserConnectionStatus(): ConnectionStatus {
  if (typeof navigator === 'undefined') return 'online';
  return navigator.onLine === false ? 'offline' : 'online';
}

const ShellLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { connectionStatus, setConnectionStatus, logoutBlocked } = useShellStatus();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const logoutBackButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOffline = () => setConnectionStatus('offline');
    const handleOnline = () => setConnectionStatus('online');

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [setConnectionStatus]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // El estado de Mi cubículo lo publica su integración real. En el resto
    // de rutas, el shell refleja el estado del navegador.
    if (!location.pathname.startsWith('/cajero')) {
      setConnectionStatus(getBrowserConnectionStatus());
    }
  }, [location.pathname, setConnectionStatus]);

  const handleLogout = async () => {
    if (logoutBlocked) {
      setLogoutDialogOpen(true);
      return;
    }

    await logout();
    navigate('/login', { replace: true });
  };

  const role = user?.role ?? 'RECEPTION';

  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
    >
      <a href="#main-content" className="app-skip-link">
        Saltar al contenido principal
      </a>

      <AppNavbar
        user={user}
        connectionStatus={connectionStatus}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onLogout={() => void handleLogout()}
      />

      <AppSidebar
        role={role}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      />

      <Outlet />

      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Content
          className="app-mobile-drawer"
          aria-label="Menú de navegación"
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <Dialog.Title>Menú de navegación</Dialog.Title>
          </VisuallyHidden>

          <AppSidebar
            role={role}
            collapsed={false}
            mobile
            onNavigate={() => setMobileMenuOpen(false)}
            onClose={() => setMobileMenuOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <Dialog.Content
          size="2"
          className="app-logout-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-blocked-title"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            logoutBackButtonRef.current?.focus();
          }}
        >
          <Dialog.Title
            id="logout-blocked-title"
            className="app-logout-dialog-title"
          >
            Turno activo en progreso
          </Dialog.Title>
          <Dialog.Description size="2" className="app-logout-dialog-description">
            No puedes cerrar sesión durante un turno activo. Finaliza la atención
            antes de salir.
          </Dialog.Description>

          <div className="app-logout-dialog-actions">
            <button
              ref={logoutBackButtonRef}
              type="button"
              onClick={() => setLogoutDialogOpen(false)}
              className="app-logout-dialog-button"
            >
              <ExclamationTriangleIcon width={16} height={16} aria-hidden="true" />
              Volver al turno
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
};

export const AppShell: React.FC = () => (
  <ShellStatusProvider>
    <ShellLayout />
  </ShellStatusProvider>
);
