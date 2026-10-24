import { describe, expect, it } from 'vitest';
import {
  APP_NAVIGATION,
  DEFAULT_ROUTE_BY_ROLE,
  getNavigationForRole,
  isNavigationItemActive,
  NAVIGATION_SECTION_LABEL,
} from './navigation-config';

describe('Configuración de navegación por rol', () => {
  it('RECEPTION solo recibe Generar turno', () => {
    const items = getNavigationForRole('RECEPTION');

    expect(items.map((item) => item.label)).toEqual(['Generar turno']);
    expect(items.map((item) => item.path)).toEqual(['/recepcion']);
  });

  it('CASHIER solo recibe Mi cubículo', () => {
    const items = getNavigationForRole('CASHIER');

    expect(items.map((item) => item.label)).toEqual(['Mi cubículo']);
    expect(items.map((item) => item.path)).toEqual(['/cajero']);
  });

  it('ADMIN recibe Cubículos e Historial, sin módulos operativos', () => {
    const items = getNavigationForRole('ADMIN');

    expect(items.map((item) => item.label)).toEqual(['Cubículos', 'Historial']);
    expect(items.map((item) => item.path)).toEqual([
      '/admin/cubiculos',
      '/admin/historial',
    ]);
    expect(items.some((item) => item.label === 'Generar turno')).toBe(false);
    expect(items.some((item) => item.label === 'Mi cubículo')).toBe(false);
  });

  it('cada elemento declara únicamente los roles autorizados', () => {
    expect(APP_NAVIGATION.every((item) => item.allowedRoles.length > 0)).toBe(true);
    expect(APP_NAVIGATION.every((item) => item.label && item.path && item.icon)).toBe(true);
  });

  it('identifica la ruta activa exacta y sus rutas hijas', () => {
    const adminItem = getNavigationForRole('ADMIN')[0];

    expect(adminItem).toBeDefined();
    expect(isNavigationItemActive(adminItem, '/admin/cubiculos')).toBe(true);
    expect(isNavigationItemActive(adminItem, '/admin/cubiculos/03')).toBe(true);
    expect(isNavigationItemActive(adminItem, '/admin/historial')).toBe(false);
    expect(isNavigationItemActive(adminItem, '/recepcion')).toBe(false);
  });

  it('define la ruta inicial y el contexto de sección por rol', () => {
    expect(DEFAULT_ROUTE_BY_ROLE).toEqual({
      RECEPTION: '/recepcion',
      CASHIER: '/cajero',
      ADMIN: '/admin/cubiculos',
    });
    expect(NAVIGATION_SECTION_LABEL.RECEPTION).toBe('Operación');
    expect(NAVIGATION_SECTION_LABEL.CASHIER).toBe('Operación');
    expect(NAVIGATION_SECTION_LABEL.ADMIN).toBe('Administración');
  });
});
