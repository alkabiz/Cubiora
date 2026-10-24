import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, IconButton, ScrollArea, Text, Tooltip } from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon, Cross2Icon } from '@radix-ui/react-icons';
import {
  type AppRole,
  getNavigationForRole,
  isNavigationItemActive,
  NAVIGATION_SECTION_LABEL,
  type NavigationItem,
} from './navigation-config';
import { SidebarOperativeSummary } from './sidebar-operative-summary';

interface SidebarBrandProps {
  sectionLabel: string;
  collapsed: boolean;
}

const SidebarBrand: React.FC<SidebarBrandProps> = ({ sectionLabel, collapsed }) => (
  <div className={`app-sidebar-brand${collapsed ? ' is-collapsed' : ''}`}>
    <span className="app-sidebar-brand-mark" aria-hidden="true">
      C
    </span>
    <div className="app-sidebar-brand-copy">
      <Text as="span" size="1" weight="bold" className="app-sidebar-brand-eyebrow">
        {sectionLabel}
      </Text>
      <Text as="span" size="1" className="app-sidebar-brand-caption">
        Navegación principal
      </Text>
    </div>
  </div>
);

interface SidebarNavigationProps {
  role: AppRole;
  collapsed: boolean;
  mobile: boolean;
  onNavigate?: () => void;
}

const NavigationLink: React.FC<{
  item: NavigationItem;
  collapsed: boolean;
  isActive: boolean;
  onNavigate?: () => void;
}> = ({ item, collapsed, isActive, onNavigate }) => {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.path}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={[
        'app-sidebar-link',
        isActive ? 'is-active' : '',
        collapsed ? 'is-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className="app-sidebar-link-icon" aria-hidden="true" />
      <span className="app-sidebar-link-label">{item.label}</span>
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip content={item.label} side="right" delayDuration={250}>
      {link}
    </Tooltip>
  );
};

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  role,
  collapsed,
  mobile,
  onNavigate,
}) => {
  const items = getNavigationForRole(role);
  const { pathname } = useLocation();

  return (
    <nav aria-label={mobile ? 'Navegación principal móvil' : 'Navegación principal'}>
      <div className="app-sidebar-links">
        {items.map((item) => (
          <NavigationLink
            key={item.path}
            item={item}
            collapsed={collapsed}
            isActive={isNavigationItemActive(item, pathname)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
};

interface SidebarFooterProps {
  collapsed: boolean;
}

const SidebarFooter: React.FC<SidebarFooterProps> = ({ collapsed }) => (
  <footer className="app-sidebar-footer">
    <Text as="p" size="1" weight="bold" className="app-sidebar-footer-title">
      Cubiora PMV
    </Text>
    <Text as="p" size="1" className="app-sidebar-footer-version">
      {collapsed ? 'v0.1.0' : 'Versión 0.1.0'}
    </Text>
  </footer>
);

export interface AppSidebarProps {
  role: AppRole;
  collapsed: boolean;
  mobile?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  role,
  collapsed,
  mobile = false,
  onToggleCollapsed,
  onNavigate,
  onClose,
}) => {
  const sectionLabel = NAVIGATION_SECTION_LABEL[role];
  const toggleLabel = collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral';

  return (
    <aside
      className={`app-sidebar${collapsed ? ' is-collapsed' : ''}${mobile ? ' is-mobile' : ''}`}
      aria-label={mobile ? 'Menú lateral móvil' : 'Barra lateral'}
    >
      <div className="app-sidebar-inner">
        <div className="app-sidebar-brand-row">
          <SidebarBrand sectionLabel={sectionLabel} collapsed={collapsed} />

          {onToggleCollapsed && (
            <Tooltip content={toggleLabel} side="right">
              <IconButton
                type="button"
                variant="ghost"
                color="gray"
                size="1"
                aria-label={toggleLabel}
                onClick={onToggleCollapsed}
                className="app-sidebar-collapse-button"
              >
                {collapsed ? (
                  <ChevronRightIcon width={16} height={16} aria-hidden="true" />
                ) : (
                  <ChevronLeftIcon width={16} height={16} aria-hidden="true" />
                )}
              </IconButton>
            </Tooltip>
          )}

          {onClose && (
            <IconButton
              type="button"
              variant="ghost"
              color="gray"
              size="2"
              aria-label="Cerrar menú"
              onClick={onClose}
              className="app-sidebar-close-button"
            >
              <Cross2Icon width={18} height={18} aria-hidden="true" />
            </IconButton>
          )}
        </div>

        <Box className="app-sidebar-navigation">
          <ScrollArea type="auto" scrollbars="vertical" className="app-sidebar-scroll">
            <SidebarNavigation
              role={role}
              collapsed={collapsed}
              mobile={mobile}
              onNavigate={onNavigate}
            />
          </ScrollArea>
        </Box>

        <SidebarOperativeSummary role={role} collapsed={collapsed} />

        <SidebarFooter collapsed={collapsed} />
      </div>
    </aside>
  );
};
