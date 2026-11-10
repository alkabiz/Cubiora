import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ulid } from 'ulid';
import {
  ApiErrorCode,
  PharmacistDto,
  PharmacistMetricsSummaryDto,
  PharmacistOperationalRole,
  PharmacistStatus,
  PharmacistsListResponseDto,
  TicketStatus,
  WorkShift,
} from '@cubiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { OperationalTelemetryService } from '../operational-telemetry/operational-telemetry.service';
import { CreatePharmacistDto } from './dto/create-pharmacist.dto';
import { UpdatePharmacistDto } from './dto/update-pharmacist.dto';

export interface ListPharmacistsFilter {
  search?: string | undefined;
  facilityId?: string | undefined;
  operationalRole?: string | undefined;
  status?: string | undefined;
}

type PharmacistRecordWithRelations = {
  id: string;
  userId: string | null;
  fullName: string;
  licenseNumber: string;
  operationalRole: string;
  facilityId: string | null;
  cubicleId: string | null;
  shift: string;
  status: string;
  email: string;
  phone: string;
  dispatchesCount: number;
  createdAt?: Date;
  updatedAt?: Date;
  facility?: { id: string; code: string; name: string } | null;
  cubicle?: { id: string; code: string; displayName: string } | null;
};

@Injectable()
export class PharmacistsService {
  private readonly logger = new Logger(PharmacistsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly telemetryService?: OperationalTelemetryService,
  ) {}

  private mapToDto(row: PharmacistRecordWithRelations): PharmacistDto {
    return {
      id: row.id,
      userId: row.userId ?? null,
      fullName: row.fullName,
      licenseNumber: row.licenseNumber,
      operationalRole: row.operationalRole as PharmacistOperationalRole,
      facilityId: row.facilityId ?? null,
      facilityName: row.facility?.name ?? null,
      facilityCode: row.facility?.code ?? null,
      defaultCubicleId: row.cubicleId ?? null,
      defaultCubicleName: row.cubicle?.displayName ?? null,
      shift: row.shift as WorkShift,
      status: row.status as PharmacistStatus,
      email: row.email,
      phone: row.phone,
      dispatchesCount: row.dispatchesCount,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
    };
  }

  private async emitTelemetryForCubicles(cubicleIds: Array<string | null | undefined>): Promise<void> {
    if (!this.telemetryService) return;
    const uniqueIds = Array.from(
      new Set(cubicleIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    );
    for (const cubicleId of uniqueIds) {
      await this.telemetryService.emitCubicleUpdate(cubicleId);
    }
    if (uniqueIds.length > 0) {
      await this.telemetryService.broadcastSnapshot();
    }
  }

  async findAll(filters: ListPharmacistsFilter = {}): Promise<PharmacistsListResponseDto> {
    const where: Prisma.PharmacistWhereInput = {};

    const search = filters.search?.trim();
    if (search && search.length > 0) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters.facilityId && filters.facilityId !== 'ALL') {
      where.facilityId = filters.facilityId.trim();
    }

    if (
      filters.operationalRole &&
      filters.operationalRole !== 'ALL' &&
      Object.values(PharmacistOperationalRole).includes(
        filters.operationalRole as PharmacistOperationalRole,
      )
    ) {
      where.operationalRole = filters.operationalRole as PharmacistOperationalRole;
    }

    if (
      filters.status &&
      filters.status !== 'ALL' &&
      Object.values(PharmacistStatus).includes(filters.status as PharmacistStatus)
    ) {
      where.status = filters.status as PharmacistStatus;
    }

    const [filteredRows, allPharmacists, closedTickets] = await Promise.all([
      this.prisma.pharmacist.findMany({
        where,
        include: {
          facility: { select: { id: true, code: true, name: true } },
          cubicle: { select: { id: true, code: true, displayName: true } },
        },
        orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      }),
      this.prisma.pharmacist.findMany({
        select: {
          status: true,
          dispatchesCount: true,
          facilityId: true,
        },
      }),
      this.prisma.ticket?.findMany
        ? this.prisma.ticket.findMany({
            where: {
              status: TicketStatus.CLOSED,
              serviceStartedAt: { not: null },
              closedAt: { not: null },
            },
            select: {
              serviceStartedAt: true,
              closedAt: true,
            },
            take: 200,
            orderBy: { closedAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const serviceMinutes = closedTickets
      .map((t) => {
        if (!t.serviceStartedAt || !t.closedAt) return null;
        const mins = (new Date(t.closedAt).getTime() - new Date(t.serviceStartedAt).getTime()) / 60000;
        return Number.isFinite(mins) && mins >= 0 ? mins : null;
      })
      .filter((val): val is number => val !== null);

    const averageServiceMinutes =
      serviceMinutes.length > 0
        ? Math.round((serviceMinutes.reduce((acc, v) => acc + v, 0) / serviceMinutes.length) * 10) / 10
        : 4.7;

    const assignedFacilities = new Set(
      allPharmacists
        .map((p) => p.facilityId)
        .filter((fid): fid is string => typeof fid === 'string' && fid.length > 0),
    );

    const metrics: PharmacistMetricsSummaryDto = {
      totalRegistered: allPharmacists.length,
      activeToday: allPharmacists.filter((p) => p.status === PharmacistStatus.ACTIVE).length,
      onLeaveCount: allPharmacists.filter((p) => p.status === PharmacistStatus.ON_LEAVE).length,
      totalDispatches: allPharmacists.reduce((acc, p) => acc + (p.dispatchesCount || 0), 0),
      averageServiceMinutes,
      assignedFacilitiesCount: assignedFacilities.size,
    };

    return {
      items: filteredRows.map((row) => this.mapToDto(row)),
      metrics,
    };
  }

  async create(dto: CreatePharmacistDto): Promise<PharmacistDto> {
    const normalizedLicense = dto.licenseNumber.trim().toUpperCase();
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingConflict = await this.prisma.pharmacist.findFirst({
      where: {
        OR: [{ licenseNumber: normalizedLicense }, { email: normalizedEmail }],
      },
      select: { id: true, licenseNumber: true, email: true },
    });

    if (existingConflict) {
      const conflictField =
        existingConflict.licenseNumber === normalizedLicense
          ? `La matrícula profesional '${normalizedLicense}' ya se encuentra registrada.`
          : `El correo '${normalizedEmail}' ya pertenece a otro farmacéutico.`;
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: conflictField,
      });
    }

    const requestedCubicleId =
      dto.cubicleId !== undefined ? dto.cubicleId : dto.defaultCubicleId ?? null;
    let resolvedFacilityId = dto.facilityId ?? null;

    if (resolvedFacilityId) {
      const facility = await this.prisma.facility.findUnique({
        where: { id: resolvedFacilityId },
        select: { id: true },
      });
      if (!facility) {
        throw new NotFoundException({
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          message: `La sede con id '${resolvedFacilityId}' no existe.`,
        });
      }
    }

    if (requestedCubicleId) {
      const cubicle = await this.prisma.cubicle.findUnique({
        where: { id: requestedCubicleId },
        select: { id: true, facilityId: true },
      });
      if (!cubicle) {
        throw new NotFoundException({
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          message: `El cubículo con id '${requestedCubicleId}' no existe.`,
        });
      }
      if (resolvedFacilityId && cubicle.facilityId && cubicle.facilityId !== resolvedFacilityId) {
        throw new BadRequestException({
          code: ApiErrorCode.REQUEST_INVALID,
          message: 'El cubículo seleccionado no pertenece a la sede asignada.',
        });
      }
      if (!resolvedFacilityId && cubicle.facilityId) {
        resolvedFacilityId = cubicle.facilityId;
      }
    }

    const status = dto.status ?? PharmacistStatus.ACTIVE;

    const created = await this.prisma.$transaction(async (tx) => {
      const pharmacistId = ulid();

      if (requestedCubicleId) {
        await tx.pharmacist.updateMany({
          where: { cubicleId: requestedCubicleId },
          data: { cubicleId: null },
        });
      }

      const persisted = await tx.pharmacist.create({
        data: {
          id: pharmacistId,
          fullName: dto.fullName.trim(),
          licenseNumber: normalizedLicense,
          operationalRole: dto.operationalRole,
          shift: dto.shift,
          status,
          email: normalizedEmail,
          phone: (dto.phone ?? '').trim(),
          dispatchesCount: dto.dispatchesCount ?? 0,
          facilityId: resolvedFacilityId,
          cubicleId: requestedCubicleId,
          userId: dto.userId ?? null,
        },
        include: {
          facility: { select: { id: true, code: true, name: true } },
          cubicle: { select: { id: true, code: true, displayName: true } },
        },
      });

      if (requestedCubicleId) {
        await tx.cubicle.update({
          where: { id: requestedCubicleId },
          data: {
            operatorName: status === PharmacistStatus.INACTIVE ? null : persisted.fullName,
            version: { increment: 1 },
          },
        });
      }

      return persisted;
    });

    await this.emitTelemetryForCubicles([requestedCubicleId]);
    this.logger.log(`Farmacéutico ${created.licenseNumber} (${created.fullName}) registrado.`);

    return this.mapToDto(created);
  }

  async update(id: string, dto: UpdatePharmacistDto): Promise<PharmacistDto> {
    const existing = await this.prisma.pharmacist.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        licenseNumber: true,
        email: true,
        facilityId: true,
        cubicleId: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El farmacéutico con id '${id}' no existe.`,
      });
    }

    const normalizedLicense = dto.licenseNumber?.trim().toUpperCase();
    const normalizedEmail = dto.email?.trim().toLowerCase();

    if (normalizedLicense || normalizedEmail) {
      const conflict = await this.prisma.pharmacist.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(normalizedLicense ? [{ licenseNumber: normalizedLicense }] : []),
            ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ],
        },
        select: { licenseNumber: true, email: true },
      });

      if (conflict) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message:
            normalizedLicense && conflict.licenseNumber === normalizedLicense
              ? `La matrícula profesional '${normalizedLicense}' ya está en uso.`
              : `El correo electrónico '${normalizedEmail}' ya está en uso.`,
        });
      }
    }

    const hasCubicleUpdate =
      dto.cubicleId !== undefined || dto.defaultCubicleId !== undefined;
    const requestedCubicleId = hasCubicleUpdate
      ? dto.cubicleId !== undefined
        ? dto.cubicleId
        : dto.defaultCubicleId ?? null
      : existing.cubicleId;

    let resolvedFacilityId =
      dto.facilityId !== undefined ? dto.facilityId : existing.facilityId;

    if (dto.facilityId) {
      const facility = await this.prisma.facility.findUnique({
        where: { id: dto.facilityId },
        select: { id: true },
      });
      if (!facility) {
        throw new NotFoundException({
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          message: `La sede con id '${dto.facilityId}' no existe.`,
        });
      }
    }

    // Si cambió de sede sin especificar cubículo nuevo, limpiar cubículo si pertenecía a la sede anterior
    let finalCubicleId = requestedCubicleId;
    if (finalCubicleId) {
      const targetCubicle = await this.prisma.cubicle.findUnique({
        where: { id: finalCubicleId },
        select: { id: true, facilityId: true },
      });
      if (!targetCubicle) {
        throw new NotFoundException({
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          message: `El cubículo con id '${finalCubicleId}' no existe.`,
        });
      }
      if (resolvedFacilityId && targetCubicle.facilityId && targetCubicle.facilityId !== resolvedFacilityId) {
        if (!hasCubicleUpdate) {
          finalCubicleId = null;
        } else {
          throw new BadRequestException({
            code: ApiErrorCode.REQUEST_INVALID,
            message: 'El cubículo seleccionado no pertenece a la sede asignada.',
          });
        }
      } else if (!resolvedFacilityId && targetCubicle.facilityId) {
        resolvedFacilityId = targetCubicle.facilityId;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (existing.cubicleId && existing.cubicleId !== finalCubicleId) {
        await tx.cubicle.updateMany({
          where: { id: existing.cubicleId, operatorName: existing.fullName },
          data: { operatorName: null, version: { increment: 1 } },
        });
      }

      if (finalCubicleId) {
        await tx.pharmacist.updateMany({
          where: { cubicleId: finalCubicleId, id: { not: id } },
          data: { cubicleId: null },
        });
      }

      const persisted = await tx.pharmacist.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
          ...(normalizedLicense ? { licenseNumber: normalizedLicense } : {}),
          ...(dto.operationalRole !== undefined ? { operationalRole: dto.operationalRole } : {}),
          ...(dto.shift !== undefined ? { shift: dto.shift } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
          ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
          ...(dto.dispatchesCount !== undefined ? { dispatchesCount: dto.dispatchesCount } : {}),
          facilityId: resolvedFacilityId,
          cubicleId: finalCubicleId,
        },
        include: {
          facility: { select: { id: true, code: true, name: true } },
          cubicle: { select: { id: true, code: true, displayName: true } },
        },
      });

      if (finalCubicleId) {
        await tx.cubicle.update({
          where: { id: finalCubicleId },
          data: {
            operatorName:
              persisted.status === PharmacistStatus.INACTIVE ? null : persisted.fullName,
            version: { increment: 1 },
          },
        });
      }

      return persisted;
    });

    await this.emitTelemetryForCubicles([existing.cubicleId, updated.cubicleId]);
    return this.mapToDto(updated);
  }

  async updateStatus(id: string, status: PharmacistStatus): Promise<PharmacistDto> {
    const existing = await this.prisma.pharmacist.findUnique({
      where: { id },
      select: { id: true, fullName: true, cubicleId: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El farmacéutico con id '${id}' no existe.`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const persisted = await tx.pharmacist.update({
        where: { id },
        data: { status },
        include: {
          facility: { select: { id: true, code: true, name: true } },
          cubicle: { select: { id: true, code: true, displayName: true } },
        },
      });

      if (existing.cubicleId) {
        await tx.cubicle.update({
          where: { id: existing.cubicleId },
          data: {
            operatorName: status === PharmacistStatus.INACTIVE ? null : persisted.fullName,
            version: { increment: 1 },
          },
        });
      }

      return persisted;
    });

    await this.emitTelemetryForCubicles([existing.cubicleId]);
    return this.mapToDto(updated);
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.prisma.pharmacist.findUnique({
      where: { id },
      select: { id: true, fullName: true, cubicleId: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El farmacéutico con id '${id}' no existe.`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing.cubicleId) {
        await tx.cubicle.updateMany({
          where: { id: existing.cubicleId, operatorName: existing.fullName },
          data: { operatorName: null, version: { increment: 1 } },
        });
      }

      await tx.pharmacist.delete({
        where: { id },
      });
    });

    await this.emitTelemetryForCubicles([existing.cubicleId]);
    this.logger.log(`Farmacéutico ${existing.fullName} (${id}) dado de baja.`);
    return { deleted: true, id };
  }
}

