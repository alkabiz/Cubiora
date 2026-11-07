import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CubiclesService, resolveDailyTargetSeconds } from '../cubicles/cubicles.service';
import {
  CubicleStatus,
  QueueCategory,
  TicketStatus,
  UserRole,
  TelemetryCubicleState,
  TelemetryQueuedTicket,
  TelemetryDailyKpis,
  TelemetrySlaAlert,
  TelemetryHourlyBucket,
  TelemetrySnapshotPayload,
  CubicleStateChangedPayload,
  QueueUpdatedPayload,
  AdminCubicleVisualStatus,
} from '@cubiora/shared';

/** Módulo de atención mapeado por código de cubículo. */
function resolveModuleCode(cubicleCode: string): string {
  if (cubicleCode.endsWith('01') || cubicleCode.endsWith('02')) return 'MOD-A';
  if (cubicleCode.endsWith('03') || cubicleCode.endsWith('04')) return 'MOD-B';
  return 'MOD-C';
}

/** Mapea CubicleStatus + tiempo transcurrido al estado visual de SCR-ADM-001. */
function resolveVisualStatus(
  domainStatus: CubicleStatus,
  serviceStartedAt: Date | null,
  slaThresholdSeconds: number,
): AdminCubicleVisualStatus {
  switch (domainStatus) {
    case CubicleStatus.BUSY: {
      if (serviceStartedAt) {
        const elapsedSeconds = (Date.now() - serviceStartedAt.getTime()) / 1000;
        return elapsedSeconds > slaThresholdSeconds ? 'SLA_EXCEDIDO' : 'ATENDIENDO';
      }
      return 'ATENDIENDO';
    }
    case CubicleStatus.CALLING:
      return 'LLAMANDO';
    case CubicleStatus.AVAILABLE:
    case CubicleStatus.RESERVED:
      return 'DISPONIBLE';
    case CubicleStatus.INACTIVE:
    default:
      return 'INACTIVO';
  }
}

/** Hora actual en formato "HH:00" para los buckets de flujo por hora. */
function formatHourBucket(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

/** Hora en formato "HH:mm:ss" para visualización de emisión de turno. */
function formatTimeHms(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
}

@Injectable()
export class OperationalTelemetryService {
  private readonly logger = new Logger(OperationalTelemetryService.name);

  private readonly cubicleUpdateSubject = new Subject<CubicleStateChangedPayload>();
  private readonly queueUpdateSubject = new Subject<QueueUpdatedPayload>();
  private readonly snapshotBroadcastSubject = new Subject<TelemetrySnapshotPayload>();

  public readonly onCubicleUpdate$: Observable<CubicleStateChangedPayload> =
    this.cubicleUpdateSubject.asObservable();
  public readonly onQueueUpdate$: Observable<QueueUpdatedPayload> =
    this.queueUpdateSubject.asObservable();
  public readonly onSnapshotBroadcast$: Observable<TelemetrySnapshotPayload> =
    this.snapshotBroadcastSubject.asObservable();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cubiclesService: CubiclesService,
  ) {}

  /**
   * Construye el snapshot completo de telemetría para SCR-ADM-001.
   * Solo expone publicCode — CERO PII.
   */
  async buildSnapshot(): Promise<TelemetrySnapshotPayload> {
    const slaThresholdSeconds = resolveDailyTargetSeconds();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    // ─── Consultas paralelas ───────────────────────────────────────────────────
    const [cubiclesRaw, pendingTickets, closedToday, noShowToday] = await Promise.all([
      // Todos los cubículos con su ticket activo y operador asignado
      this.prisma.cubicle.findMany({
        orderBy: { code: 'asc' },
        include: {
          tickets: {
            where: {
              status: {
                in: [
                  TicketStatus.ASSIGNED,
                  TicketStatus.CALLED,
                  TicketStatus.IN_SERVICE,
                ],
              },
            },
            orderBy: { assignedAt: 'desc' },
            take: 1,
            select: {
              publicCode: true,
              status: true,
              serviceStartedAt: true,
              calledAt: true,
              assignedAt: true,
            },
          },
          // Operador asignado a este cubículo
          currentOperator: {
            select: { displayName: true, role: true, active: true },
          },
        },
      }),

      // Turnos en espera (PENDING) ordenados por prioridad + secuencia
      this.prisma.ticket.findMany({
        where: { status: TicketStatus.PENDING },
        orderBy: [{ sequenceNumber: 'asc' }],
        select: {
          publicCode: true,
          queueCategory: true,
          createdAt: true,
        },
      }),

      // Turnos cerrados hoy con sus tiempos de servicio
      this.prisma.ticket.findMany({
        where: {
          status: TicketStatus.CLOSED,
          closedAt: { gte: startOfDay, lt: endOfDay },
        },
        select: {
          serviceStartedAt: true,
          closedAt: true,
          cubicleId: true,
        },
      }),

      // No presentados hoy
      this.prisma.ticket.count({
        where: {
          status: TicketStatus.NO_SHOW,
          closedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);

    // ─── Cubículos diarios por código (para dailyCompletedCount) ──────────────
    const dailyCountByCubicle = new Map<string, number>();
    for (const t of closedToday) {
      if (t.cubicleId) {
        dailyCountByCubicle.set(t.cubicleId, (dailyCountByCubicle.get(t.cubicleId) ?? 0) + 1);
      }
    }

    // ─── Construir estados de cubículos ───────────────────────────────────────
    const cubicles: TelemetryCubicleState[] = cubiclesRaw.map((cub) => {
      const activeTicket = cub.tickets[0] ?? null;
      const domainStatus = cub.status as CubicleStatus;
      const serviceStartedAt = activeTicket?.serviceStartedAt ?? null;
      const visualStatus = resolveVisualStatus(domainStatus, serviceStartedAt, slaThresholdSeconds);

      const isSlaExceeded =
        visualStatus === 'SLA_EXCEDIDO' ||
        (visualStatus === 'ATENDIENDO' &&
          serviceStartedAt !== null &&
          (Date.now() - serviceStartedAt.getTime()) / 1000 > slaThresholdSeconds);

      // Operador: usuario asignado actualmente al cubículo
      const operatorDisplayName =
        cub.currentOperator?.active && cub.currentOperator.role === UserRole.CASHIER
          ? cub.currentOperator.displayName
          : null;

      // idleSinceAt: solo aplica cuando el cubículo está AVAILABLE
      const idleSinceAt =
        domainStatus === CubicleStatus.AVAILABLE ? now.toISOString() : null;

      return {
        cubicleCode: cub.code,
        displayName: cub.displayName,
        moduleCode: resolveModuleCode(cub.code),
        visualStatus,
        domainStatus,
        activeTicketPublicCode: activeTicket?.publicCode ?? null,
        operatorDisplayName,
        serviceStartedAt: serviceStartedAt?.toISOString() ?? null,
        idleSinceAt,
        calledAt: activeTicket?.calledAt?.toISOString() ?? null,
        dailyCompletedCount: dailyCountByCubicle.get(cub.id) ?? 0,
        slaThresholdSeconds,
        isSlaExceeded,
        stateChangedAt: now.toISOString(),
      };
    });

    // ─── Cola de espera ───────────────────────────────────────────────────────
    const queue: TelemetryQueuedTicket[] = pendingTickets.map((t, idx) => ({
      position: idx + 1,
      ticketPublicCode: t.publicCode,
      queueCategory: t.queueCategory as QueueCategory,
      issuedAtIso: t.createdAt.toISOString(),
      issuedAtFormatted: formatTimeHms(t.createdAt),
    }));

    // ─── KPIs del día ─────────────────────────────────────────────────────────
    const activeCubicles = cubicles.filter((c) => c.visualStatus !== 'INACTIVO').length;
    const totalCubicles = cubicles.length;
    const closedCount = closedToday.length;

    const durations = closedToday
      .map((t) => {
        if (!t.serviceStartedAt || !t.closedAt) return null;
        const s = (t.closedAt.getTime() - t.serviceStartedAt.getTime()) / 1000;
        return Number.isFinite(s) && s >= 0 ? s : null;
      })
      .filter((s): s is number => s !== null);

    const slaCompliantCount = durations.filter((s) => s <= slaThresholdSeconds).length;
    const slaCompliancePercentage =
      durations.length > 0
        ? Math.round((slaCompliantCount / durations.length) * 1000) / 10
        : null;

    const noShowCount = noShowToday;
    const totalFinalized = closedCount + noShowCount;
    const noShowRate =
      totalFinalized > 0
        ? Math.round((noShowCount / totalFinalized) * 10000) / 100
        : null;

    const kpis: TelemetryDailyKpis = {
      waitingCount: queue.length,
      activeCubicles,
      totalCubicles,
      closedTodayCount: closedCount,
      slaCompliancePercentage,
      noShowTodayCount: noShowCount,
      noShowRate,
    };

    // ─── Alerta SLA ───────────────────────────────────────────────────────────
    const exceedingCubicles = cubicles.filter((c) => c.isSlaExceeded && c.serviceStartedAt);
    exceedingCubicles.sort((a, b) => {
      const elapsedA = a.serviceStartedAt
        ? (Date.now() - new Date(a.serviceStartedAt).getTime()) / 1000
        : 0;
      const elapsedB = b.serviceStartedAt
        ? (Date.now() - new Date(b.serviceStartedAt).getTime()) / 1000
        : 0;
      return elapsedB - elapsedA; // Mayor desviación primero
    });

    const worst = exceedingCubicles[0] ?? null;
    const worstElapsed = worst?.serviceStartedAt
      ? Math.round((Date.now() - new Date(worst.serviceStartedAt).getTime()) / 1000)
      : null;

    const slaAlert: TelemetrySlaAlert = {
      isActive: exceedingCubicles.length > 0,
      worstCubicleCode: worst?.cubicleCode ?? null,
      worstCubicleDisplay: worst?.displayName ?? null,
      affectedTicketCode: worst?.activeTicketPublicCode ?? null,
      elapsedSeconds: worstElapsed,
      thresholdSeconds: slaThresholdSeconds,
      slaCompliancePercentage,
    };

    // ─── Flujo por hora ───────────────────────────────────────────────────────
    // Agrupa los cierres de hoy en buckets de 1 hora
    const hourBuckets = new Map<string, number>();
    for (const t of closedToday) {
      if (t.closedAt) {
        const bucket = formatHourBucket(t.closedAt);
        hourBuckets.set(bucket, (hourBuckets.get(bucket) ?? 0) + 1);
      }
    }
    // Genera buckets de 07:00 a 18:00 (horario operativo típico)
    const hourlyFlow: TelemetryHourlyBucket[] = [];
    for (let h = 7; h <= 18; h++) {
      const key = `${String(h).padStart(2, '0')}:00`;
      hourlyFlow.push({ hour: key, count: hourBuckets.get(key) ?? 0 });
    }

    return {
      cubicles,
      queue,
      kpis,
      slaAlert,
      hourlyFlow,
      serverTime: now.toISOString(),
    };
  }

  /**
   * Construye el estado actualizado de UN cubículo específico por su ID interno.
   * Llamado por los casos de uso (call, startService, close, noShow) después
   * de confirmar la transacción en la base de datos.
   */
  async buildCubicleState(cubicleId: string): Promise<TelemetryCubicleState> {
    const slaThresholdSeconds = resolveDailyTargetSeconds();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    const [cub, dailyCount] = await Promise.all([
      this.prisma.cubicle.findUnique({
        where: { id: cubicleId },
        include: {
          tickets: {
            where: {
              status: {
                in: [TicketStatus.ASSIGNED, TicketStatus.CALLED, TicketStatus.IN_SERVICE],
              },
            },
            orderBy: { assignedAt: 'desc' },
            take: 1,
            select: {
              publicCode: true,
              status: true,
              serviceStartedAt: true,
              calledAt: true,
              assignedAt: true,
            },
          },
          currentOperator: {
            select: { displayName: true, role: true, active: true },
          },
        },
      }),
      this.prisma.ticket.count({
        where: {
          cubicleId,
          status: TicketStatus.CLOSED,
          closedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);

    if (!cub) {
      throw new Error(`Cubículo con id ${cubicleId} no encontrado en telemetría`);
    }

    const activeTicket = cub.tickets[0] ?? null;
    const domainStatus = cub.status as CubicleStatus;
    const serviceStartedAt = activeTicket?.serviceStartedAt ?? null;
    const visualStatus = resolveVisualStatus(domainStatus, serviceStartedAt, slaThresholdSeconds);

    const isSlaExceeded =
      serviceStartedAt !== null &&
      (Date.now() - serviceStartedAt.getTime()) / 1000 > slaThresholdSeconds;

    const operatorDisplayName =
      cub.currentOperator?.active && cub.currentOperator.role === UserRole.CASHIER
        ? cub.currentOperator.displayName
        : null;

    return {
      cubicleCode: cub.code,
      displayName: cub.displayName,
      moduleCode: resolveModuleCode(cub.code),
      visualStatus,
      domainStatus,
      activeTicketPublicCode: activeTicket?.publicCode ?? null,
      operatorDisplayName,
      serviceStartedAt: serviceStartedAt?.toISOString() ?? null,
      idleSinceAt: domainStatus === CubicleStatus.AVAILABLE ? now.toISOString() : null,
      calledAt: activeTicket?.calledAt?.toISOString() ?? null,
      dailyCompletedCount: dailyCount,
      slaThresholdSeconds,
      isSlaExceeded,
      stateChangedAt: now.toISOString(),
    };
  }

  /**
   * Notifica cambio de estado de un cubículo a los clientes conectados.
   */
  async emitCubicleUpdate(cubicleId: string): Promise<void> {
    try {
      const cubicle = await this.buildCubicleState(cubicleId);
      this.cubicleUpdateSubject.next({
        cubicle,
        serverTime: new Date().toISOString(),
      });
      this.logger.debug(
        `Emitida actualización reactiva de cubículo ${cubicle.cubicleCode} (${cubicle.visualStatus})`,
      );
    } catch (err) {
      this.logger.error(`Error emitiendo telemetría para cubículo ${cubicleId}:`, err);
    }
  }

  /**
   * Notifica actualización de cola y KPIs a los clientes conectados.
   */
  async emitQueueUpdate(): Promise<void> {
    try {
      const snapshot = await this.buildSnapshot();
      this.queueUpdateSubject.next({
        queue: snapshot.queue,
        kpis: snapshot.kpis,
        slaAlert: snapshot.slaAlert,
        serverTime: snapshot.serverTime,
      });
      this.logger.debug(
        `Emitida actualización reactiva de cola: ${snapshot.queue.length} turnos en espera`,
      );
    } catch (err) {
      this.logger.error('Error emitiendo telemetría de cola:', err);
    }
  }

  /**
   * Fuerza el broadcast de un snapshot completo a todos los administradores.
   */
  async broadcastSnapshot(): Promise<void> {
    try {
      const snapshot = await this.buildSnapshot();
      this.snapshotBroadcastSubject.next(snapshot);
      this.logger.debug('Snapshot global de telemetría emitido por broadcast');
    } catch (err) {
      this.logger.error('Error en broadcast de snapshot de telemetría:', err);
    }
  }
}

