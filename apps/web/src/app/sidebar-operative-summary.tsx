import React from 'react';
import { Skeleton, Text, Tooltip } from '@radix-ui/themes';
import {
  PersonIcon,
  ClockIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';
import { formatWaitTime, formatSla, useCashierMetrics } from '../features/cashier/use-cashier-metrics';
import type { AppRole } from './navigation-config';

interface SidebarOperativeSummaryProps {
  role: AppRole;
  collapsed: boolean;
}

/**
 * Tarjeta de resumen operativo para operadores de cubículo (CASHIER) y administradores (ADMIN).
 *
 * - Visible para los roles CASHIER y ADMIN.
 * - No visible para RECEPTION ni pantalla pública.
 * - En sidebar colapsado: se oculta completamente (las métricas no caben).
 * - No es interactiva ni navega a ningún lugar.
 * - No incluye datos personales.
 */
export const SidebarOperativeSummary: React.FC<SidebarOperativeSummaryProps> = ({
  role,
  collapsed,
}) => {
  const isAuthorized = role === 'CASHIER' || role === 'ADMIN';
  const { status, data, isStale } = useCashierMetrics(isAuthorized && !collapsed);

  // No mostrar para otros roles (ej. RECEPTION) ni en sidebar colapsado
  if (!isAuthorized || collapsed) return null;

  if (status === 'idle' || status === 'loading') {
    return (
      <div
        className="sidebar-summary-card sidebar-summary-card--loading"
        aria-label="Cargando resumen operativo"
        aria-busy="true"
      >
        <Skeleton className="sidebar-summary-skeleton" />
        <Skeleton className="sidebar-summary-skeleton" />
        <Skeleton className="sidebar-summary-skeleton sidebar-summary-skeleton--short" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="sidebar-summary-card sidebar-summary-card--error"
        role="status"
        aria-label="Error en resumen operativo"
      >
        <Text as="p" size="1" className="sidebar-summary-error-text">
          No fue posible cargar el resumen.
        </Text>
      </div>
    );
  }

  // status === 'success' | 'offline'
  const activeCount = data?.activeCount ?? null;
  const avgWait = data?.avgWaitSeconds ?? null;
  const sla = data?.slaCompliancePct ?? null;

  return (
    <div
      className={`sidebar-summary-card${isStale ? ' is-stale' : ''}`}
      role="status"
      aria-label={isStale ? 'Resumen operativo (desactualizado)' : 'Resumen operativo'}
      aria-live="polite"
    >
      {isStale && (
        <Tooltip content="Sin conexión — datos del último sondeo confirmado" side="top">
          <span className="sidebar-summary-stale-badge" aria-hidden="true">
            Sin conexión
          </span>
        </Tooltip>
      )}

      <div className="sidebar-summary-row">
        <span className="sidebar-summary-icon" aria-hidden="true">
          <PersonIcon width={14} height={14} />
        </span>
        <Text as="span" size="1" className="sidebar-summary-label">
          Turnos en gestión
        </Text>
        <Text as="span" size="1" weight="bold" className="sidebar-summary-value">
          {activeCount !== null ? activeCount : '—'}
        </Text>
      </div>

      <div className="sidebar-summary-row">
        <span className="sidebar-summary-icon" aria-hidden="true">
          <ClockIcon width={14} height={14} />
        </span>
        <Text as="span" size="1" className="sidebar-summary-label">
          Espera promedio
        </Text>
        <Text as="span" size="1" weight="bold" className="sidebar-summary-value sidebar-summary-value--accent">
          {formatWaitTime(avgWait)}
        </Text>
      </div>

      <div className="sidebar-summary-row">
        <span className="sidebar-summary-icon" aria-hidden="true">
          <CheckCircledIcon width={14} height={14} />
        </span>
        <Text as="span" size="1" className="sidebar-summary-label">
          Cumplimiento SLA
        </Text>
        <Text as="span" size="1" weight="bold" className="sidebar-summary-value sidebar-summary-value--accent">
          {formatSla(sla)}
        </Text>
      </div>
    </div>
  );
};
