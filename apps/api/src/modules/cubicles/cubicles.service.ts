import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CubicleDailyPerformance,
  CubicleSnapshot,
  CubicleStatus,
  TicketStatus,
  UserRole,
  ApiErrorCode,
  maskDocument,
} from '@cubiora/shared';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/** Objetivo operativo inicial: atenciones finalizadas en ≤ 12 minutos. */
export const DEFAULT_DAILY_TARGET_SECONDS = 12 * 60;

/**
 * Objetivo operativo configurable del rendimiento diario por cubículo.
 * La configuración vive en el backend; React nunca fija el valor.
 */
export function resolveDailyTargetSeconds(
  rawValue: string | undefined = process.env['CUBICLE_DAILY_TARGET_SECONDS'],
): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_TARGET_SECONDS;
  }
  return Math.round(parsed);
}

function resolveCurrentDayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return { start, end };
}

@Injectable()
export class CubiclesService {
  private readonly logger = new Logger(CubiclesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene o asegura la existencia de un cubículo por su código y retorna su snapshot actual.
   * Soporta formatos como 'CUB-03', '03', 'CUB-01', '1', etc.
   */
  async getOrCreateCubicleByCode(codeParam: string): Promise<CubicleSnapshot> {
    const rawCode = codeParam.trim().toUpperCase();
    const normalizedCode = rawCode.startsWith('CUB-') ? rawCode : `CUB-${rawCode.padStart(2, '0')}`;

    // 1. Buscar cubículo en la base de datos
    let cubicle = await this.prisma.cubicle.findFirst({
      where: {
        OR: [{ code: normalizedCode }, { code: rawCode }],
      },
    });

    // 2. Si no existe, inicializarlo de manera automática y segura
    if (!cubicle) {
      const displayNumber = rawCode.replace(/\D/g, '') || '01';
      const paddedNumber = displayNumber.padStart(2, '0');
      const cubicleId = ulid();

      cubicle = await this.prisma.cubicle.create({
        data: {
          id: cubicleId,
          code: normalizedCode,
          displayName: `Cubículo ${paddedNumber}`,
          status: CubicleStatus.AVAILABLE,
          active: true,
          version: 1,
        },
      });
      this.logger.log(`Cubículo ${cubicle.code} inicializado automáticamente con id ${cubicle.id}`);
    }

    return this.buildCubicleSnapshot(cubicle.id);
  }

  /**
   * Construye el snapshot completo del cubículo buscando el ticket activo si existe.
   */
  async buildCubicleSnapshot(cubicleId: string): Promise<CubicleSnapshot> {
    const cubicle = await this.prisma.cubicle.findUnique({
      where: { id: cubicleId },
    });

    if (!cubicle) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `Cubículo no encontrado con id ${cubicleId}`,
      });
    }

    // El turno activo y la cola se consultan en paralelo. La cola cuenta
    // únicamente turnos PENDING: los que todavía no tienen cubículo asignado.
    const [activeTicketRaw, waitingCount] = await Promise.all([
      this.prisma.ticket.findFirst({
        where: {
          cubicleId: cubicle.id,
          status: {
            in: [TicketStatus.ASSIGNED, TicketStatus.CALLED, TicketStatus.IN_SERVICE],
          },
        },
        include: {
          calls: {
            orderBy: { callNumber: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.ticket.count({
        where: { status: TicketStatus.PENDING },
      }),
    ]);

    let activeTicket = null;
    if (activeTicketRaw) {
      const lastCall = activeTicketRaw.calls[0];
      activeTicket = {
        id: activeTicketRaw.id,
        publicId: activeTicketRaw.publicId,
        publicCode: activeTicketRaw.publicCode,
        patientName: activeTicketRaw.patientName,
        maskedDocument: maskDocument(activeTicketRaw.patientDocument),
        status: activeTicketRaw.status as TicketStatus,
        version: activeTicketRaw.version,
        assignedAt: activeTicketRaw.assignedAt?.toISOString() ?? null,
        calledAt: activeTicketRaw.calledAt?.toISOString() ?? null,
        serviceStartedAt: activeTicketRaw.serviceStartedAt?.toISOString() ?? null,
        callNumber: lastCall?.callNumber ?? 0,
      };
    }

    return {
      cubicle: {
        id: cubicle.id,
        code: cubicle.code,
        displayName: cubicle.displayName,
        status: cubicle.status as CubicleStatus,
        version: cubicle.version,
      },
      activeTicket,
      waitingCount,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Obtiene el rendimiento diario de un cubículo.
   *
   * Reglas:
   * - Solo turnos CLOSED de la jornada actual del servidor.
   * - CANCELLED y NO_SHOW quedan excluidos por el filtro de estado.
   * - El promedio usa serviceStartedAt → closedAt.
   * - El cumplimiento compara cada duración contra el objetivo configurado.
   * - Si no hay turnos cerrados con tiempos válidos, retorna null (nunca NaN/Infinity).
   * - No expone datos personales de pacientes.
   */
  async getDailyPerformance(
    cubicleCode: string,
    user: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<CubicleDailyPerformance> {
    const rawCode = cubicleCode.trim().toUpperCase();
    const normalizedCode = rawCode.startsWith('CUB-') ? rawCode : `CUB-${rawCode.padStart(2, '0')}`;

    const [cubicle, databaseUser] = await Promise.all([
      this.prisma.cubicle.findFirst({
        where: {
          OR: [{ code: normalizedCode }, { code: rawCode }],
        },
        select: { id: true, code: true },
      }),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, cubicleId: true, active: true },
      }),
    ]);

    if (!databaseUser || !databaseUser.active) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Acceso denegado: el usuario no está activo.',
      });
    }

    if (databaseUser.role !== UserRole.CASHIER && databaseUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Acceso denegado: solo CASHIER y ADMIN pueden consultar el rendimiento del cubículo.',
      });
    }

    if (!cubicle) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: 'Cubículo no encontrado.',
      });
    }

    if (databaseUser.role === UserRole.CASHIER && databaseUser.cubicleId !== cubicle.id) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Acceso denegado: el operador de caja solo puede consultar su cubículo asignado.',
      });
    }

    const { start, end } = resolveCurrentDayRange(now);

    const closedTickets = await this.prisma.ticket.findMany({
      where: {
        cubicleId: cubicle.id,
        status: TicketStatus.CLOSED,
        closedAt: { gte: start, lt: end },
      },
      select: {
        serviceStartedAt: true,
        closedAt: true,
      },
    });

    const durations = closedTickets
      .map((ticket) => {
        if (!ticket.serviceStartedAt || !ticket.closedAt) return null;
        const seconds =
          (ticket.closedAt.getTime() - ticket.serviceStartedAt.getTime()) / 1000;
        return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
      })
      .filter((seconds): seconds is number => seconds !== null);

    const averageServiceSeconds =
      durations.length > 0
        ? Math.round(durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length)
        : null;

    const targetSeconds = resolveDailyTargetSeconds();
    const targetCompliancePercentage =
      durations.length > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (durations.filter((seconds) => seconds <= targetSeconds).length /
                  durations.length) *
                  1000,
              ) / 10,
            ),
          )
        : null;

    return {
      cubicleCode: cubicle.code,
      completedTickets: closedTickets.length,
      averageServiceSeconds,
      targetSeconds,
      targetCompliancePercentage,
      calculatedAt: now.toISOString(),
    };
  }
}
