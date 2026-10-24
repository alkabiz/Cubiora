import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Card, Flex, Heading, Separator, Skeleton, Text } from '@radix-ui/themes';
import { CheckCircledIcon, ClockIcon, PersonIcon } from '@radix-ui/react-icons';
import type { CubicleOutcome } from './types';
import {
  dailyPerformanceQueryKey,
  formatCompletedTickets,
  formatServiceDuration,
  formatTargetCompliance,
  formatTargetSeconds,
  useCubicleDailyPerformance,
} from './use-cubicle-daily-performance';

export interface CubicleDailyPerformanceCardProps {
  cubicleCode: string;
  /**
   * Resultado confirmado del workspace. Cuando es un cierre, la CARD invalida
   * la consulta para reflejar el nuevo turno completado sin sondeo agresivo.
   */
  outcome?: CubicleOutcome | null;
  className?: string;
}

const VALUE_STYLE: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Flex justify="between" align="center" gap="4">
      <Flex align="center" gap="2" className="min-w-0">
        <span className="text-[#64748B] shrink-0" aria-hidden="true">
          {icon}
        </span>
        <Text as="span" size="2" color="gray">
          {label}
        </Text>
      </Flex>
      <Text as="span" size="2" weight="bold" style={VALUE_STYLE}>
        {value}
      </Text>
    </Flex>
  );
}

function LoadingCard({ className = '' }: { className?: string }) {
  return (
    <Card
      size="2"
      role="region"
      aria-label="Rendimiento del cubículo hoy"
      aria-busy="true"
      className={`cubicle-performance-card ${className}`.trim()}
    >
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center" gap="3">
          <Heading as="h2" size="4" weight="bold">
            Rendimiento del cubículo hoy
          </Heading>
          <Skeleton width="88px" height="20px" />
        </Flex>

        <Separator size="4" />

        <Skeleton height="16px" />
        <Skeleton height="16px" />
        <Skeleton height="16px" width="82%" />
      </Flex>
    </Card>
  );
}

/**
 * CMP-SCR-CAJ-001 · Rendimiento del cubículo hoy.
 *
 * Presenta exclusivamente métricas calculadas por el backend para la jornada
 * actual: turnos completados, duración promedio y cumplimiento del objetivo.
 * No incluye datos personales, rankings ni comparaciones entre operadores.
 */
export const CubicleDailyPerformanceCard: React.FC<CubicleDailyPerformanceCardProps> = ({
  cubicleCode,
  outcome = null,
  className = '',
}) => {
  const queryClient = useQueryClient();
  const lastInvalidatedCloseRef = useRef<string | null>(null);
  const { data, isLoading, isError, isStale } = useCubicleDailyPerformance(cubicleCode);

  useEffect(() => {
    if (outcome?.type !== 'CLOSED') return;
    if (lastInvalidatedCloseRef.current === outcome.finishedCode) return;

    lastInvalidatedCloseRef.current = outcome.finishedCode;
    void queryClient.invalidateQueries({
      queryKey: dailyPerformanceQueryKey(cubicleCode),
    });
  }, [cubicleCode, outcome, queryClient]);

  if (isLoading) {
    return <LoadingCard className={className} />;
  }

  if (isError && !data) {
    return (
      <Card
        size="2"
        role="status"
        aria-label="Error en el rendimiento del cubículo"
        className={`cubicle-performance-card ${className}`.trim()}
      >
        <Flex direction="column" gap="2">
          <Heading as="h2" size="4" weight="bold">
            Rendimiento del cubículo hoy
          </Heading>
          <Text as="p" size="1" color="gray">
            No fue posible cargar el rendimiento del cubículo
          </Text>
        </Flex>
      </Card>
    );
  }

  const completedTickets = data?.completedTickets;
  const hasCompletedTickets = typeof completedTickets === 'number' && completedTickets > 0;
  const completedValue = hasCompletedTickets ? formatCompletedTickets(completedTickets) : '—';
  const averageValue = hasCompletedTickets
    ? formatServiceDuration(data?.averageServiceSeconds)
    : '—';
  const complianceValue = hasCompletedTickets
    ? formatTargetCompliance(data?.targetCompliancePercentage)
    : '—';
  const targetValue = formatTargetSeconds(data?.targetSeconds);

  return (
    <Card
      size="2"
      role="region"
      aria-label="Rendimiento del cubículo hoy"
      aria-live="polite"
      className={`cubicle-performance-card ${className}`.trim()}
    >
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Heading as="h2" size="4" weight="bold">
              Rendimiento del cubículo hoy
            </Heading>
            <Text as="p" size="1" color="gray">
              Jornada actual · {data?.cubicleCode ?? cubicleCode}
            </Text>
          </Flex>

          <Flex align="center" gap="2" wrap="wrap">
            {isStale && (
              <Badge color="amber" variant="soft" size="1">
                Datos desactualizados
              </Badge>
            )}
            <Badge color="blue" variant="soft" size="1">
              Objetivo ≤ {targetValue}
            </Badge>
          </Flex>
        </Flex>

        <Separator size="4" />

        <Flex direction="column" gap="3">
          <MetricRow
            icon={<PersonIcon width={14} height={14} />}
            label="Turnos completados"
            value={completedValue}
          />
          <Separator size="4" />
          <MetricRow
            icon={<ClockIcon width={14} height={14} />}
            label="Tiempo promedio por turno"
            value={averageValue}
          />
          <Separator size="4" />
          <MetricRow
            icon={<CheckCircledIcon width={14} height={14} />}
            label="Cumplimiento del objetivo operativo"
            value={complianceValue}
          />
        </Flex>

        {!hasCompletedTickets && (
          <Text as="p" size="1" color="gray">
            Aún no hay turnos completados
          </Text>
        )}
      </Flex>
    </Card>
  );
};
