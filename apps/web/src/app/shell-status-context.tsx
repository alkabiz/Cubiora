import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ConnectionStatus = 'online' | 'offline' | 'checking';

interface ShellStatusContextValue {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  logoutBlocked: boolean;
  setLogoutBlocked: (blocked: boolean) => void;
}

const ShellStatusContext = createContext<ShellStatusContextValue | null>(null);

function getBrowserConnectionStatus(): ConnectionStatus {
  if (typeof navigator === 'undefined') return 'online';
  return navigator.onLine === false ? 'offline' : 'online';
}

export const ShellStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    getBrowserConnectionStatus,
  );
  const [logoutBlocked, setLogoutBlocked] = useState(false);

  const value = useMemo(
    () => ({
      connectionStatus,
      setConnectionStatus,
      logoutBlocked,
      setLogoutBlocked,
    }),
    [connectionStatus, logoutBlocked],
  );

  return <ShellStatusContext.Provider value={value}>{children}</ShellStatusContext.Provider>;
};

export function useShellStatus(): ShellStatusContextValue {
  const context = useContext(ShellStatusContext);

  if (!context) {
    return {
      connectionStatus: getBrowserConnectionStatus(),
      setConnectionStatus: () => undefined,
      logoutBlocked: false,
      setLogoutBlocked: () => undefined,
    };
  }

  return context;
}

interface OperationalStatusOptions {
  online: boolean;
  checking?: boolean;
  logoutBlocked?: boolean;
}

/**
 * Publica el estado operativo real de una pantalla en el shell.
 * No crea un segundo canal de conexión ni modifica la lógica de turnos.
 */
export function useShellOperationalStatus({
  online,
  checking = false,
  logoutBlocked = false,
}: OperationalStatusOptions): void {
  const { setConnectionStatus, setLogoutBlocked } = useShellStatus();

  useEffect(() => {
    setConnectionStatus(checking ? 'checking' : online ? 'online' : 'offline');
  }, [checking, online, setConnectionStatus]);

  useEffect(() => {
    setLogoutBlocked(logoutBlocked);
    return () => setLogoutBlocked(false);
  }, [logoutBlocked, setLogoutBlocked]);
}
