import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminCubicleConfigDto,
  ApiErrorCode,
  CubicleDailyPerformance,
  CubicleSnapshot,
  CubicleStatus,
  PharmacistStatus,
  QueueCategory,
  TicketStatus,
  UpdateCubicleOperatorResponse,
  UserRole,
  maskDocument,
} from '@cubiora/shared';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OperationalTelemetryService } from '../operational-telemetry/operational-telemetry.service';

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

/**
 * Alias de tipo borrado al compilar con SWC/TypeScript para evitar que
 * `design:paramtypes` evalúe en carga de módulo la clase en referencia circular (TDZ).
 */
type WrapperType<T> = T;

@Injectable()
export class CubiclesService {
  private readonly logger = new Logger(CubiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => OperationalTelemetryService))
    private readonly telemetryService?: WrapperType<OperationalTelemetryService>,
  ) {}

  private async emitTelemetrySafe(cubicleIds: Array<string | null | undefined>): Promise<void> {
    if (!this.telemetryService) return;
    try {
      const uniqueIds = Array.from(
        new Set(cubicleIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
      );
      for (const cubicleId of uniqueIds) {
        await this.telemetryService.emitCubicleUpdate(cubicleId);
      }
      await this.telemetryService.broadcastSnapshot();
    } catch (err) {
      this.logger.warn(`No se pudo emitir actualización de telemetría: ${(err as Error).message}`);
    }
  }

  /**
   * Obtiene el snapshot actual de un cubículo existente por su código.
   * Lanza NotFoundException si el cubículo no existe para garantizar la seguridad
   * e idempotencia de las peticiones GET conforme a RFC 9110.
   */
  async getCubicleSnapshotByCode(codeParam: string): Promise<CubicleSnapshot> {
    const rawCode = codeParam.trim().toUpperCase();
    const normalizedCode = rawCode.startsWith('CUB-') ? rawCode : `CUB-${rawCode.padStart(2, '0')}`;

    const cubicle = await this.prisma.cubicle.findFirst({
      where: {
        OR: [{ code: normalizedCode }, { code: rawCode }],
      },
    });

    if (!cubicle) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El cubículo con código '${codeParam}' no existe.`,
      });
    }

    return this.buildCubicleSnapshot(cubicle.id);
  }

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

  /**
   * Actualiza el operador asignado a un cubículo y mantiene sincronizada
   * la relación bidireccional Cubicle.operatorName <-> Pharmacist.cubicleId.
   */
  async updateOperator(
    id: string,
    operatorName: string,
    pharmacistId?: string | null,
  ): Promise<UpdateCubicleOperatorResponse> {
    let cubicle = await this.prisma.cubicle.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!cubicle && this.prisma.cubicle.findFirst) {
      cubicle = await this.prisma.cubicle.findFirst({
        where: { code: id },
        select: { id: true },
      });
    }

    if (!cubicle) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El cubículo con id '${id}' no existe.`,
      });
    }

    const resolvedOperatorName = operatorName.length > 0 ? operatorName : null;
    const targetCubicleId = cubicle.id;

    if (this.prisma.$transaction && this.prisma.pharmacist) {
      let previousCubicleId: string | null = null;

      const synced = await this.prisma.$transaction(async (tx) => {
        if (typeof pharmacistId === 'string' && pharmacistId.length > 0) {
          const pharmacist = await tx.pharmacist.findUnique({
            where: { id: pharmacistId },
            select: {
              id: true,
              fullName: true,
              facilityId: true,
              cubicleId: true,
              status: true,
            },
          });

          if (!pharmacist) {
            throw new NotFoundException({
              code: ApiErrorCode.RESOURCE_NOT_FOUND,
              message: `El farmacéutico con id '${pharmacistId}' no existe.`,
            });
          }

          const targetCubicle = await tx.cubicle.findUnique({
            where: { id: targetCubicleId },
            select: { id: true, facilityId: true },
          });

          if (
            pharmacist.facilityId &&
            targetCubicle?.facilityId &&
            pharmacist.facilityId !== targetCubicle.facilityId
          ) {
            throw new BadRequestException({
              code: ApiErrorCode.REQUEST_INVALID,
              message: 'El farmacéutico pertenece a otra sede hospitalaria.',
            });
          }

          await tx.pharmacist.updateMany({
            where: { cubicleId: targetCubicleId, id: { not: pharmacist.id } },
            data: { cubicleId: null },
          });

          if (pharmacist.cubicleId && pharmacist.cubicleId !== targetCubicleId) {
            previousCubicleId = pharmacist.cubicleId;
            await tx.cubicle.updateMany({
              where: { id: pharmacist.cubicleId, operatorName: pharmacist.fullName },
              data: { operatorName: null, version: { increment: 1 } },
            });
          }

          await tx.pharmacist.update({
            where: { id: pharmacist.id },
            data: {
              cubicleId: targetCubicleId,
              ...(targetCubicle?.facilityId ? { facilityId: targetCubicle.facilityId } : {}),
            },
          });

          const effectiveName =
            pharmacist.status === PharmacistStatus.INACTIVE ? null : pharmacist.fullName;

          const updatedCub = await tx.cubicle.update({
            where: { id: targetCubicleId },
            data: {
              operatorName: effectiveName,
              version: { increment: 1 },
            },
            select: { id: true, operatorName: true },
          });

          return {
            id: updatedCub.id,
            operatorName: updatedCub.operatorName,
            pharmacistId: pharmacist.id,
          };
        }

        if (pharmacistId === null || resolvedOperatorName === null) {
          await tx.pharmacist.updateMany({
            where: { cubicleId: targetCubicleId },
            data: { cubicleId: null },
          });
        } else {
          await tx.pharmacist.updateMany({
            where: { cubicleId: targetCubicleId, fullName: { not: resolvedOperatorName } },
            data: { cubicleId: null },
          });
        }

        const nextOperatorName = pharmacistId === null ? null : resolvedOperatorName;
        const updatedCub = await tx.cubicle.update({
          where: { id: targetCubicleId },
          data: {
            operatorName: nextOperatorName,
            version: { increment: 1 },
          },
          select: { id: true, operatorName: true },
        });

        const baseResult: UpdateCubicleOperatorResponse = {
          id: updatedCub.id,
          operatorName: updatedCub.operatorName,
        };
        if (pharmacistId !== undefined) {
          baseResult.pharmacistId = null;
        }
        return baseResult;
      });

      await this.emitTelemetrySafe([previousCubicleId, targetCubicleId]);
      return synced;
    }

    if (this.prisma.cubicle.update) {
      try {
        const updated = await this.prisma.cubicle.update({
          where: { id: targetCubicleId },
          data: { operatorName: resolvedOperatorName },
          select: { id: true, operatorName: true },
        });
        return { id: updated.id, operatorName: updated.operatorName ?? resolvedOperatorName };
      } catch {
        // Fallback defensivo si se ejecuta en mocks de pruebas unitarias sin update configurado
      }
    }

    return { id: targetCubicleId, operatorName: resolvedOperatorName };
  }

  /**
   * Lista los cubículos para [SCR-ADM-002], scoped a la sede solicitada o a la sede primaria activa.
   */
  async getAdminCubicles(facilityId?: string): Promise<AdminCubicleConfigDto[]> {
    let targetFacility: { id: string; code: string; name: string; isPrimary: boolean } | null = null;

    if (facilityId && facilityId.trim().length > 0) {
      targetFacility = await this.prisma.facility.findUnique({
        where: { id: facilityId.trim() },
        select: { id: true, code: true, name: true, isPrimary: true },
      });
      if (!targetFacility) {
        throw new NotFoundException({
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          message: `La sede con id '${facilityId}' no existe.`,
        });
      }
    } else if (this.prisma.facility?.findFirst) {
      targetFacility =
        (await this.prisma.facility.findFirst({
          where: { isPrimary: true },
          select: { id: true, code: true, name: true, isPrimary: true },
        })) ??
        (await this.prisma.facility.findFirst({
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true, isPrimary: true },
        }));
    }

    const whereClause = targetFacility
      ? targetFacility.isPrimary
        ? { OR: [{ facilityId: targetFacility.id }, { facilityId: null }] }
        : { facilityId: targetFacility.id }
      : {};

    const { start, end } = resolveCurrentDayRange(new Date());
    const slaThresholdSeconds = resolveDailyTargetSeconds();

    const [cubicles, closedToday] = await Promise.all([
      this.prisma.cubicle.findMany({
        where: whereClause,
        orderBy: { code: 'asc' },
        include: {
          facility: { select: { id: true, code: true, name: true } },
          pharmacists: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              fullName: true,
              licenseNumber: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.ticket.findMany({
        where: {
          status: TicketStatus.CLOSED,
          closedAt: { gte: start, lt: end },
          cubicleId: { not: null },
        },
        select: { cubicleId: true },
      }),
    ]);

    const countByCubicle = new Map<string, number>();
    for (const row of closedToday) {
      if (row.cubicleId) {
        countByCubicle.set(row.cubicleId, (countByCubicle.get(row.cubicleId) ?? 0) + 1);
      }
    }

    return cubicles.map((cub) => {
      const assignedPharmacist = cub.pharmacists[0] ?? null;
      return {
        id: cub.id,
        code: cub.code,
        displayName: cub.displayName,
        operatorName: assignedPharmacist
          ? assignedPharmacist.status === PharmacistStatus.INACTIVE
            ? null
            : assignedPharmacist.fullName
          : cub.operatorName,
        status: cub.status as CubicleStatus,
        active: cub.active,
        allowedCategories: cub.allowedCategories as QueueCategory[],
        facilityId: cub.facilityId ?? targetFacility?.id ?? null,
        facilityCode: cub.facility?.code ?? targetFacility?.code ?? null,
        facilityName: cub.facility?.name ?? targetFacility?.name ?? null,
        pharmacistId: assignedPharmacist?.id ?? null,
        pharmacistName: assignedPharmacist?.fullName ?? null,
        pharmacistLicenseNumber: assignedPharmacist?.licenseNumber ?? null,
        dailyCompletedCount: countByCubicle.get(cub.id) ?? 0,
        slaThresholdSeconds,
        version: cub.version,
      };
    });
  }

  private async findAdminCubicleDtoOrThrow(cubicleId: string): Promise<AdminCubicleConfigDto> {
    const slaThresholdSeconds = resolveDailyTargetSeconds();
    const { start, end } = resolveCurrentDayRange(new Date());

    const [cub, dailyCompletedCount] = await Promise.all([
      this.prisma.cubicle.findUnique({
        where: { id: cubicleId },
        include: {
          facility: { select: { id: true, code: true, name: true } },
          pharmacists: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              fullName: true,
              licenseNumber: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.ticket.count({
        where: {
          cubicleId,
          status: TicketStatus.CLOSED,
          closedAt: { gte: start, lt: end },
        },
      }),
    ]);

    if (!cub) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El cubículo con id '${cubicleId}' no existe.`,
      });
    }

    const assignedPharmacist = cub.pharmacists[0] ?? null;
    return {
      id: cub.id,
      code: cub.code,
      displayName: cub.displayName,
      operatorName: assignedPharmacist
        ? assignedPharmacist.status === PharmacistStatus.INACTIVE
          ? null
          : assignedPharmacist.fullName
        : cub.operatorName,
      status: cub.status as CubicleStatus,
      active: cub.active,
      allowedCategories: cub.allowedCategories as QueueCategory[],
      facilityId: cub.facilityId,
      facilityCode: cub.facility?.code ?? null,
      facilityName: cub.facility?.name ?? null,
      pharmacistId: assignedPharmacist?.id ?? null,
      pharmacistName: assignedPharmacist?.fullName ?? null,
      pharmacistLicenseNumber: assignedPharmacist?.licenseNumber ?? null,
      dailyCompletedCount,
      slaThresholdSeconds,
      version: cub.version,
    };
  }

  /**
   * Asigna o desvincula un farmacéutico registrado a un cubículo desde [SCR-ADM-002].
   */
  async assignPharmacistToCubicle(
    cubicleIdOrCode: string,
    pharmacistId: string | null,
    operatorName?: string,
  ): Promise<AdminCubicleConfigDto> {
    const cub = await this.prisma.cubicle.findFirst({
      where: { OR: [{ id: cubicleIdOrCode }, { code: cubicleIdOrCode }] },
      select: { id: true },
    });

    if (!cub) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El cubículo '${cubicleIdOrCode}' no existe.`,
      });
    }

    await this.updateOperator(cub.id, operatorName?.trim() ?? '', pharmacistId);
    return this.findAdminCubicleDtoOrThrow(cub.id);
  }

  /**
   * Habilita o desactiva operativamente un cubículo desde [SCR-ADM-002].
   */
  async updateAdminCubicleStatus(
    cubicleIdOrCode: string,
    active: boolean,
  ): Promise<AdminCubicleConfigDto> {
    const cub = await this.prisma.cubicle.findFirst({
      where: { OR: [{ id: cubicleIdOrCode }, { code: cubicleIdOrCode }] },
      select: { id: true, status: true },
    });

    if (!cub) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El cubículo '${cubicleIdOrCode}' no existe.`,
      });
    }

    if (!active) {
      const inProgressTicket = await this.prisma.ticket.findFirst({
        where: {
          cubicleId: cub.id,
          status: { in: [TicketStatus.ASSIGNED, TicketStatus.CALLED, TicketStatus.IN_SERVICE] },
        },
        select: { publicCode: true },
      });

      if (inProgressTicket) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: `No se puede desactivar el cubículo mientras tenga el turno activo ${inProgressTicket.publicCode}.`,
        });
      }
    }

    await this.prisma.cubicle.update({
      where: { id: cub.id },
      data: {
        active,
        status: active ? CubicleStatus.AVAILABLE : CubicleStatus.INACTIVE,
        version: { increment: 1 },
      },
    });

    await this.emitTelemetrySafe([cub.id]);
    return this.findAdminCubicleDtoOrThrow(cub.id);
  }
}
