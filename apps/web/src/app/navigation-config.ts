import React from 'react';
import {
  Activity,
  Building2,
  CirclePlus,
  Clock,
  LayoutGrid,
  Monitor,
  Users,
} from 'lucide-react';

export type AppRole = 'RECEPTION' | 'CASHIER' | 'ADMIN';

export interface NavigationItem {
  label: string;
  path: string;
  icon: React.ElementType;
  allowedRoles: AppRole[];
  exact?: boolean;
}

export const APP_NAVIGATION: NavigationItem[] = [
  {
    label: 'Generar turno',
    path: '/recepcion',
    icon: CirclePlus,
    allowedRoles: ['RECEPTION'],
  },
  {
    label: 'Mi cubículo',
    path: '/cajero',
    icon: Monitor,
    allowedRoles: ['CASHIER'],
  },
  {
    label: 'Resumen operativo',
    path: '/admin',
    icon: Activity,
    allowedRoles: ['ADMIN'],
    exact: true,
  },
  {
    label: 'Cubículos',
    path: '/admin/cubiculos',
    icon: LayoutGrid,
    allowedRoles: ['ADMIN'],
  },
  {
    label: 'Farmacéuticos',
    path: '/admin/farmaceuticos',
    icon: Users,
    allowedRoles: ['ADMIN'],
  },
  {
    label: 'Sedes y Usuarios',
    path: '/admin/sedes',
    icon: Building2,
    allowedRoles: ['ADMIN'],
  },
  {
    label: 'Historial',
    path: '/admin/historial',
    icon: Clock,
    allowedRoles: ['ADMIN'],
  },
];

export const ROLE_CONTEXT_LABEL: Record<AppRole, string> = {
  RECEPTION: 'Recepción',
  CASHIER: 'Mi cubículo',
  ADMIN: 'Administración',
};

export const ROLE_DISPLAY_LABEL: Record<AppRole, string> = {
  RECEPTION: 'Personal de recepción',
  CASHIER: 'Operador de cubículo',
  ADMIN: 'Administrador',
};

export const NAVIGATION_SECTION_LABEL: Record<AppRole, string> = {
  RECEPTION: 'Operación',
  CASHIER: 'Operación',
  ADMIN: 'Administración',
};

export const DEFAULT_ROUTE_BY_ROLE: Record<AppRole, string> = {
  RECEPTION: '/recepcion',
  CASHIER: '/cajero',
  ADMIN: '/admin',
};

export function getNavigationForRole(role: AppRole): NavigationItem[] {
  return APP_NAVIGATION.filter((item) => item.allowedRoles.includes(role));
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.path || (item.path === '/admin' && pathname === '/admin/supervision');
  }
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
