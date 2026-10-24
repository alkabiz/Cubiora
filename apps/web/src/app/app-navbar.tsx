import React from 'react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Badge,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  Tooltip,
} from '@radix-ui/themes';
import { ExitIcon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import type { AuthUser } from '../context/auth-context';
import {
  DEFAULT_ROUTE_BY_ROLE,
  ROLE_CONTEXT_LABEL,
  ROLE_DISPLAY_LABEL,
} from './navigation-config';
import type { ConnectionStatus } from './shell-status-context';
import { NavbarClock } from './navbar-clock';

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  online: 'En línea',
  offline: 'Sin conexión',
  checking: 'Verificando',
};

const CONNECTION_COLOR: Record<ConnectionStatus, 'green' | 'ruby' | 'amber'> = {
  online: 'green',
  offline: 'ruby',
  checking: 'amber',
};

function getInitials(displayName: string | undefined, username: string | undefined): string {
  const source = (displayName || username || 'Usuario').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return (parts[0] ?? 'U').slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

const ConnectionBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => (
  <Badge
    size="1"
    variant="soft"
    color={CONNECTION_COLOR[status]}
    radius="full"
    role="status"
    aria-live="polite"
    aria-label={`Estado de conexión: ${CONNECTION_LABEL[status]}`}
    className={`app-connection-badge is-${status}`}
  >
    <span className="app-connection-dot" aria-hidden="true" />
    {CONNECTION_LABEL[status]}
  </Badge>
);

export interface AppNavbarProps {
  user: AuthUser | null;
  connectionStatus: ConnectionStatus;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  user,
  connectionStatus,
  onOpenMobileMenu,
  onLogout,
}) => {
  const role = user?.role;
  const roleContext = role ? ROLE_CONTEXT_LABEL[role] : 'Operación';
  const roleLabel = role ? ROLE_DISPLAY_LABEL[role] : 'Sesión';
  const homePath = role ? DEFAULT_ROUTE_BY_ROLE[role] : '/login';
  const initials = getInitials(user?.displayName, user?.username);

  return (
    <header className="app-navbar">
      <div className="app-navbar-left">
        <IconButton
          type="button"
          variant="ghost"
          color="gray"
          size="2"
          aria-label="Abrir menú de navegación"
          onClick={onOpenMobileMenu}
          className="app-mobile-menu-button"
        >
          <HamburgerMenuIcon width={20} height={20} aria-hidden="true" />
        </IconButton>

        <Link to={homePath} className="app-navbar-brand" aria-label="Cubiora, ir a la pantalla principal">
          <span className="app-navbar-brand-mark" aria-hidden="true">
            C
          </span>
          <span className="app-navbar-brand-copy">
            <Text as="span" size="3" weight="bold" className="app-navbar-brand-name">
              Cubiora
            </Text>
            <Text as="span" size="1" className="app-navbar-brand-subtitle">
              Gestión de turnos
            </Text>
          </span>
        </Link>

        <Badge
          size="1"
          variant="soft"
          color="blue"
          radius="full"
          className="app-role-context"
        >
          {roleContext}
        </Badge>
      </div>

      <div className="app-navbar-center">
        <ConnectionBadge status={connectionStatus} />
        <span className="app-navbar-center-divider" aria-hidden="true" />
        <NavbarClock />
      </div>

      <div className="app-navbar-right">
        {user && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <button
                type="button"
                className="app-user-trigger"
                aria-label={`Abrir menú de usuario de ${user.displayName || user.username}`}
              >
                <Avatar
                  size="2"
                  radius="full"
                  fallback={initials}
                  className="app-user-avatar"
                  aria-hidden="true"
                />
                <span className="app-user-meta">
                  <Text as="span" size="2" weight="medium" className="app-user-name">
                    {user.displayName || user.username}
                  </Text>
                  <Text as="span" size="1" className="app-user-role">
                    {roleLabel}
                  </Text>
                </span>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content align="end" sideOffset={8} className="app-user-menu">
              <DropdownMenu.Label>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">
                    {user.displayName || user.username}
                  </Text>
                  <Text size="1" color="gray">
                    {roleLabel}
                  </Text>
                </Flex>
              </DropdownMenu.Label>
              <DropdownMenu.Separator />
              <DropdownMenu.Item color="red" onSelect={onLogout} className="app-user-menu-item">
                <ExitIcon width={15} height={15} aria-hidden="true" />
                Cerrar sesión
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}

        {!user && (
          <Tooltip content="Sesión no disponible">
            <Text size="2" color="gray">
              Sin sesión
            </Text>
          </Tooltip>
        )}
      </div>
    </header>
  );
};
