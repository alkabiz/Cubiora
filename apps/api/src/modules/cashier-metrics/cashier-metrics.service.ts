import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus } from '@cubiora/shared';

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
   * (desde creación hasta inicio de atención) estuvo dentro del objetivo (≤ 15 min).
   * Es null si no hay turnos cerrados.
   */
  slaCompliancePct: number | null;
}

/** Tiempo objetivo de espera en segundos (15 minutos). */
const SLA_TARGET_SECONDS = 15 * 60;

@Injectable()
export class CashierMetricsService {
  private readonly logger = new Logger(CashierMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula el resumen operativo para operadores de cubículo.
   * No devuelve datos personales de pacientes.
   */
  async getOperativeSummary(): Promise<CashierOperativeSummary> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeCount, closedTodayWithTimes] = await Promise.all([
      // 1. Turnos actualmente en gestión
      this.prisma.ticket.count({
        where: {
          status: {
            in: [TicketStatus.ASSIGNED, TicketStatus.CALLED, TicketStatus.IN_SERVICE],
          },
        },
      }),

      // 2. Turnos cerrados hoy con sus marcas de tiempo relevantes
      this.prisma.ticket.findMany({
        where: {
          status: TicketStatus.CLOSED,
          closedAt: { gte: todayStart },
          calledAt: { not: null },
        },
        select: {
          createdAt: true,
          calledAt: true,
          serviceStartedAt: true,
        },
      }),
    ]);

    let avgWaitSeconds: number | null = null;
    let slaCompliancePct: number | null = null;

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

      // SLA: porcentaje dentro del objetivo (tiempo hasta inicio de servicio ≤ 15 min)
      const slaWaitTimes = closedTodayWithTimes
        .filter((t) => t.serviceStartedAt !== null)
        .map((t) => {
          const created = t.createdAt.getTime();
          const started = t.serviceStartedAt!.getTime();
          return (started - created) / 1000;
        })
        .filter((s) => s >= 0);

      if (slaWaitTimes.length > 0) {
        const withinSla = slaWaitTimes.filter((s) => s <= SLA_TARGET_SECONDS).length;
        slaCompliancePct = Math.round((withinSla / slaWaitTimes.length) * 1000) / 10;
      }
    }

    this.logger.debug(
      `Resumen operativo: activos=${activeCount}, espera=${avgWaitSeconds}s, SLA=${slaCompliancePct}%`,
    );

    return { activeCount, avgWaitSeconds, slaCompliancePct };
  }
}
