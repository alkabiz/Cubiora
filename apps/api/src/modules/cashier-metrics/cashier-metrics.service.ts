import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus, UserRole } from '@cubiora/shared';
import { resolveDailyTargetSeconds } from '../../config/sla-target.util';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface CashierOperativeSummary {
  /** Turnos actualmente en gestión (ASSIGNED | CALLED | IN_SERVICE) */
  activeCount: number;
  /**
   * Espera promedio en segundos calculada sobre los turnos atendidos hoy
   * (tiempo desde creación hasta primer llamado).
   * Es null si no hay suficientes datos.
   */
  avgWaitSeconds: number | null;
  /**
   * Porcentaje de turnos cerrados hoy cuyo tiempo de espera total
   * (desde creación hasta inicio de atención) estuvo dentro del umbral SLA configurado.
   * Es null si no hay turnos cerrados.
   */
  slaCompliancePct: number | null;
}

@Injectable()
export class CashierMetricsService {
  private readonly logger = new Logger(CashierMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula el resumen operativo para operadores de cubículo.
   * CASHIER queda estrictamente acotado a su cubículo asignado; ADMIN consulta la sede primaria (si existe).
   * No devuelve datos personales de pacientes.
   */
  async getOperativeSummary(user?: AuthenticatedUser): Promise<CashierOperativeSummary> {
    if (user?.role === UserRole.CASHIER && !user.cubicleId) {
      return { activeCount: 0, avgWaitSeconds: null, slaCompliancePct: null };
    }

    const slaTargetSeconds = resolveDailyTargetSeconds();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let facilityScopeId: string | null = null;
    if (user?.role !== UserRole.CASHIER && this.prisma.facility?.findFirst) {
      const primaryFacility = await this.prisma.facility.findFirst({
        where: { isPrimary: true },
        select: { id: true },
      });
      facilityScopeId = primaryFacility?.id ?? null;
    }

    const scopeWhere =
      user?.role === UserRole.CASHIER && user.cubicleId
        ? { cubicleId: user.cubicleId }
        : facilityScopeId
          ? { facilityId: facilityScopeId }
          : {};

    const activeCountPromise = this.prisma.ticket.count({
      where: {
        status: {
          in: [TicketStatus.ASSIGNED, TicketStatus.CALLED, TicketStatus.IN_SERVICE],
        },
        ...scopeWhere,
      },
    });

    let activeCount = 0;
    let avgWaitSeconds: number | null = null;
    let slaCompliancePct: number | null = null;

    if (typeof (this.prisma as { $queryRaw?: unknown }).$queryRaw === 'function') {
      const sqlAggPromise =
        user?.role === UserRole.CASHIER && user.cubicleId
          ? this.prisma.$queryRaw<
              Array<{ avg_wait_seconds: number | null; sla_compliance_pct: number | null }>
            >`
              SELECT
                ROUND(AVG(EXTRACT(EPOCH FROM (called_at - created_at))) FILTER (WHERE called_at >= created_at))::int AS avg_wait_seconds,
                CASE
                  WHEN COUNT(*) FILTER (WHERE service_started_at IS NOT NULL AND service_started_at >= created_at) > 0
                  THEN ROUND(
                    1000.0 * COUNT(*) FILTER (
                      WHERE service_started_at IS NOT NULL
                        AND service_started_at >= created_at
                        AND EXTRACT(EPOCH FROM (service_started_at - created_at)) <= ${slaTargetSeconds}
                    ) / COUNT(*) FILTER (WHERE service_started_at IS NOT NULL AND service_started_at >= created_at)
                  )::numeric / 10.0
                  ELSE NULL
                END AS sla_compliance_pct
              FROM tickets
              WHERE status = 'CLOSED'
                AND closed_at >= ${todayStart}
                AND called_at IS NOT NULL
                AND cubicle_id = ${user.cubicleId}
            `
          : facilityScopeId
            ? this.prisma.$queryRaw<
                Array<{ avg_wait_seconds: number | null; sla_compliance_pct: number | null }>
              >`
                SELECT
                  ROUND(AVG(EXTRACT(EPOCH FROM (called_at - created_at))) FILTER (WHERE called_at >= created_at))::int AS avg_wait_seconds,
                  CASE
                    WHEN COUNT(*) FILTER (WHERE service_started_at IS NOT NULL AND service_started_at >= created_at) > 0
                    THEN ROUND(
                      1000.0 * COUNT(*) FILTER (
                        WHERE service_started_at IS NOT NULL
                          AND service_started_at >= created_at
                          AND EXTRACT(EPOCH FROM (service_started_at - created_at)) <= ${slaTargetSeconds}
                      ) / COUNT(*) FILTER (WHERE service_started_at IS NOT NULL AND service_started_at >= created_at)
                    )::numeric / 10.0
                    ELSE NULL
                  END AS sla_compliance_pct
                FROM tickets
                WHERE status = 'CLOSED'
                  AND closed_at >= ${todayStart}
                  AND called_at IS NOT NULL
                  AND facility_id = ${facilityScopeId}
              `
            : this.prisma.$queryRaw<
                Array<{ avg_wait_seconds: number | null; sla_compliance_pct: number | null }>
              >`
                SELECT
                  ROUND(AVG(EXTRACT(EPOCH FROM (called_at - created_at))) FILTER (WHERE called_at >= created_at))::int AS avg_wait_seconds,
                  CASE
                    WHEN COUNT(*) FILTER (WHERE service_started_at IS NOT NULL AND service_started_at >= created_at) > 0
                    THEN ROUND(
                      1000.0 * COUNT(*) FILTER (
                        WHERE service_started_at IS NOT NULL
                          AND service_started_at >= created_at
                          AND EXTRACT(EPOCH FROM (service_started_at - created_at)) <= ${slaTargetSeconds}
                      ) / COUNT(*) FILTER (WHERE service_started_at IS NOT NULL AND service_started_at >= created_at)
                    )::numeric / 10.0
                    ELSE NULL
                  END AS sla_compliance_pct
                FROM tickets
                WHERE status = 'CLOSED'
                  AND closed_at >= ${todayStart}
                  AND called_at IS NOT NULL
              `;

      const [counted, aggRows] = await Promise.all([activeCountPromise, sqlAggPromise]);
      activeCount = counted;
      const row = aggRows?.[0];
      if (row) {
        avgWaitSeconds =
          row.avg_wait_seconds !== null && row.avg_wait_seconds !== undefined
            ? Number(row.avg_wait_seconds)
            : null;
        slaCompliancePct =
          row.sla_compliance_pct !== null && row.sla_compliance_pct !== undefined
            ? Number(row.sla_compliance_pct)
            : null;
      }
    } else {
      const [counted, closedTodayWithTimes] = await Promise.all([
        activeCountPromise,
        // 2. Turnos cerrados hoy con sus marcas de tiempo relevantes (acotados)
        this.prisma.ticket.findMany({
          where: {
            status: TicketStatus.CLOSED,
            closedAt: { gte: todayStart },
            calledAt: { not: null },
            ...scopeWhere,
          },
          select: {
            createdAt: true,
            calledAt: true,
            serviceStartedAt: true,
          },
          orderBy: { closedAt: 'desc' },
          take: 2000,
        }),
      ]);
      activeCount = counted;

      if (closedTodayWithTimes.length > 0) {
        const waitTimes = closedTodayWithTimes
          .filter((t) => t.calledAt !== null)
          .map((t) => {
            const created = t.createdAt.getTime();
            const called = t.calledAt!.getTime();
            return (called - created) / 1000; // segundos
          })
          .filter((s) => s >= 0);

        if (waitTimes.length > 0) {
          avgWaitSeconds = Math.round(
            waitTimes.reduce((sum, s) => sum + s, 0) / waitTimes.length,
          );
        }

        // SLA: porcentaje dentro del umbral SLA configurado en CUBICLE_DAILY_TARGET_SECONDS
        const slaWaitTimes = closedTodayWithTimes
          .filter((t) => t.serviceStartedAt !== null)
          .map((t) => {
            const created = t.createdAt.getTime();
            const started = t.serviceStartedAt!.getTime();
            return (started - created) / 1000;
          })
          .filter((s) => s >= 0);

        if (slaWaitTimes.length > 0) {
          const withinSla = slaWaitTimes.filter((s) => s <= slaTargetSeconds).length;
          slaCompliancePct = Math.round((withinSla / slaWaitTimes.length) * 1000) / 10;
        }
      }
    }

    this.logger.debug(
      `Resumen operativo: activos=${activeCount}, espera=${avgWaitSeconds}s, SLA=${slaCompliancePct}%`,
    );

    return { activeCount, avgWaitSeconds, slaCompliancePct };
  }
}
