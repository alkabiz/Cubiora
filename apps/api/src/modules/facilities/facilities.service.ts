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
  CubicleStatus,
  FacilityCubicleSummaryDto,
  FacilityDto,
  FacilityStatus,
  PharmacistOperationalRole,
  PharmacistStatus,
  QueueCategory,
  WorkShift,
} from '@cubiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationalTelemetryService } from '../operational-telemetry/operational-telemetry.service';
import {
  resolveEffectiveOperatorName,
  syncFacilityEnabledCubiclesCount,
  syncUserCubicleLink,
} from '../../common/utils/cubicle-assignment-sync.util';
import { AssignPharmacistToFacilityDto } from './dto/assign-pharmacist-to-facility.dto';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';

type FacilityRowWithRelations = {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  openingHours: string;
  enabledCubiclesCount: number;
  status: string;
  isPrimary: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  cubicles?: Array<{
    id: string;
    code: string;
    displayName: string;
    status: string;
    active: boolean;
    operatorName: string | null;
    currentOperator?: {
      displayName: string;
      role: string;
      active: boolean;
    } | null;
    pharmacists?: Array<{ id: string; fullName?: string; status?: string }>;
  }>;
  pharmacists?: Array<{
    id: string;
    fullName: string;
    licenseNumber: string;
    operationalRole: string;
    shift: string;
    status: string;
    cubicleId: string | null;
    cubicle?: { id: string; displayName: string } | null;
  }>;
};

function resolveCubicleShortCode(cubicleCode: string, index: number): string {
  const match = cubicleCode.match(/(\d+)$/);
  if (match && match[1]) {
    return `C${match[1].padStart(2, '0')}`;
  }
  return `C${String(index + 1).padStart(2, '0')}`;
}

function buildCubiclePrefix(facilityCode: string): string {
  const cleaned = facilityCode
    .toUpperCase()
    .replace(/^SEDE-/, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return cleaned.length > 0 ? cleaned : 'FAC';
}

@Injectable()
export class FacilitiesService {
  private readonly logger = new Logger(FacilitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly telemetryService?: OperationalTelemetryService,
  ) {}

  private mapToDto(row: FacilityRowWithRelations): FacilityDto {
    const rawCubicles = row.cubicles ?? [];
    const rawPharmacists = row.pharmacists ?? [];

    const cubicles: FacilityCubicleSummaryDto[] = rawCubicles.map((cub, idx) => ({
      id: cub.id,
      code: cub.code,
      shortCode: resolveCubicleShortCode(cub.code, idx),
      displayName: cub.displayName,
      status: cub.status as CubicleStatus,
      active: cub.active,
      operatorName: resolveEffectiveOperatorName({
        pharmacists: cub.pharmacists,
        currentOperator: cub.currentOperator ?? null,
        legacyOperatorName: cub.operatorName,
      }),
      assignedPharmacistId: cub.pharmacists?.[0]?.id ?? null,
    }));

    const activeCubiclesCount =
      rawCubicles.length > 0
        ? rawCubicles.filter((cub) => cub.active).length
        : row.enabledCubiclesCount;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      address: row.address,
      city: row.city,
      phone: row.phone,
      openingHours: row.openingHours,
      enabledCubiclesCount: activeCubiclesCount,
      status: row.status as FacilityStatus,
      isPrimary: row.isPrimary,
      cubiclesCount: rawCubicles.length > 0 ? rawCubicles.length : row.enabledCubiclesCount,
      pharmacistsCount: rawPharmacists.length,
      cubicles,
      pharmacists: rawPharmacists.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        licenseNumber: p.licenseNumber,
        operationalRole: p.operationalRole as PharmacistOperationalRole,
        shift: p.shift as WorkShift,
        status: p.status as PharmacistStatus,
        defaultCubicleId: p.cubicleId ?? null,
        defaultCubicleName: p.cubicle?.displayName ?? null,
      })),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
    };
  }

  private async findFacilityDtoOrThrow(id: string): Promise<FacilityDto> {
    const row = await this.prisma.facility.findUnique({
      where: { id },
      include: {
        cubicles: {
          orderBy: { code: 'asc' },
          include: {
            currentOperator: {
              select: { displayName: true, role: true, active: true },
            },
            pharmacists: {
              take: 1,
              orderBy: { updatedAt: 'desc' },
              select: { id: true, fullName: true, status: true },
            },
          },
        },
        pharmacists: {
          orderBy: { fullName: 'asc' },
          include: {
            cubicle: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `La sede con id '${id}' no existe.`,
      });
    }

    return this.mapToDto(row);
  }

  async findAll(): Promise<FacilityDto[]> {
    const rows = await this.prisma.facility.findMany({
      orderBy: { code: 'asc' },
      include: {
        cubicles: {
          orderBy: { code: 'asc' },
          include: {
            currentOperator: {
              select: { displayName: true, role: true, active: true },
            },
            pharmacists: {
              take: 1,
              orderBy: { updatedAt: 'desc' },
              select: { id: true, fullName: true, status: true },
            },
          },
        },
        pharmacists: {
          orderBy: { fullName: 'asc' },
          include: {
            cubicle: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    return rows.map((row) => this.mapToDto(row));
  }

  async create(dto: CreateFacilityDto): Promise<FacilityDto> {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.facility.findUnique({
      where: { code: normalizedCode },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `Ya existe una sede registrada con el código '${normalizedCode}'.`,
      });
    }

    const enabledCubiclesCount = dto.enabledCubiclesCount ?? 4;
    const status = dto.status ?? FacilityStatus.ACTIVE;
    const isFacilityActive = status === FacilityStatus.ACTIVE;

    const createdId = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.facility.updateMany({
          data: { isPrimary: false },
        });
      }

      const facilityId = ulid();
      await tx.facility.create({
        data: {
          id: facilityId,
          code: normalizedCode,
          name: dto.name.trim(),
          address: dto.address.trim(),
          city: dto.city.trim(),
          phone: (dto.phone ?? '').trim(),
          openingHours: (dto.openingHours ?? '07:00 a 20:00 hs').trim(),
          enabledCubiclesCount: isFacilityActive ? enabledCubiclesCount : 0,
          status,
          isPrimary: Boolean(dto.isPrimary),
        },
      });

      const prefix = buildCubiclePrefix(normalizedCode);
      for (let i = 1; i <= enabledCubiclesCount; i++) {
        const slot = String(i).padStart(2, '0');
        let candidateCode = `${prefix}-CUB-${slot}`;
        if (candidateCode.length > 20) {
          candidateCode = `${prefix.slice(0, 6)}-C${slot}-${facilityId.slice(-4)}`;
        }
        const collision = await tx.cubicle.findUnique({
          where: { code: candidateCode },
          select: { id: true },
        });
        if (collision) {
          candidateCode = `C${slot}-${facilityId.slice(-10)}`;
        }

        await tx.cubicle.create({
          data: {
            id: ulid(),
            code: candidateCode.slice(0, 20),
            displayName: `Cubículo ${slot}`,
            operatorName: null,
            status: isFacilityActive ? CubicleStatus.AVAILABLE : CubicleStatus.INACTIVE,
            active: isFacilityActive,
            allowedCategories: [
              QueueCategory.GENERAL,
              QueueCategory.PREFERENTIAL,
              QueueCategory.HIGH_COST,
              QueueCategory.BILLING,
            ],
            facilityId,
          },
        });
      }

      return facilityId;
    });

    if (dto.isPrimary && this.telemetryService) {
      await this.telemetryService.broadcastSnapshot();
    }

    this.logger.log(`Sede ${normalizedCode} (${dto.name}) creada con ${enabledCubiclesCount} cubículos.`);
    return this.findFacilityDtoOrThrow(createdId);
  }

  async update(id: string, dto: UpdateFacilityDto): Promise<FacilityDto> {
    const existing = await this.prisma.facility.findUnique({
      where: { id },
      include: {
        cubicles: { orderBy: { code: 'asc' } },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `La sede con id '${id}' no existe.`,
      });
    }

    const normalizedCode = dto.code?.trim().toUpperCase();
    if (normalizedCode && normalizedCode !== existing.code) {
      const conflict = await this.prisma.facility.findFirst({
        where: { code: normalizedCode, id: { not: id } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: `El código '${normalizedCode}' ya está asignado a otra sede.`,
        });
      }
    }

    const targetStatus = dto.status ?? (existing.status as FacilityStatus);
    const targetCount = dto.enabledCubiclesCount ?? existing.enabledCubiclesCount;

    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.facility.updateMany({
          where: { id: { not: id } },
          data: { isPrimary: false },
        });
      }

      await tx.facility.update({
        where: { id },
        data: {
          ...(normalizedCode ? { code: normalizedCode } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
          ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
          ...(dto.openingHours !== undefined ? { openingHours: dto.openingHours.trim() } : {}),
          ...(dto.enabledCubiclesCount !== undefined ? { enabledCubiclesCount: targetCount } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        },
      });

      const currentCubicles = existing.cubicles;
      const isFacilityActive = targetStatus === FacilityStatus.ACTIVE;

      // Sincronizar cubículos si aumenta la capacidad parametrizada
      if (targetCount > currentCubicles.length) {
        const prefix = buildCubiclePrefix(normalizedCode ?? existing.code);
        for (let i = currentCubicles.length + 1; i <= targetCount; i++) {
          const slot = String(i).padStart(2, '0');
          let candidateCode = `${prefix}-CUB-${slot}`;
          if (candidateCode.length > 20) {
            candidateCode = `${prefix.slice(0, 6)}-C${slot}-${id.slice(-4)}`;
          }
          const collision = await tx.cubicle.findUnique({
            where: { code: candidateCode },
            select: { id: true },
          });
          if (collision) {
            candidateCode = `C${slot}-${ulid().slice(-10)}`;
          }

          await tx.cubicle.create({
            data: {
              id: ulid(),
              code: candidateCode.slice(0, 20),
              displayName: `Cubículo ${slot}`,
              operatorName: null,
              status: isFacilityActive ? CubicleStatus.AVAILABLE : CubicleStatus.INACTIVE,
              active: isFacilityActive,
              allowedCategories: [
                QueueCategory.GENERAL,
                QueueCategory.PREFERENTIAL,
                QueueCategory.HIGH_COST,
                QueueCategory.BILLING,
              ],
              facilityId: id,
            },
          });
        }
      } else if (dto.enabledCubiclesCount !== undefined && targetCount < currentCubicles.length) {
        // Desactivar ventanillas excedentes sin eliminar historial
        const excessCubicles = currentCubicles.slice(targetCount);
        for (const excess of excessCubicles) {
          await tx.cubicle.update({
            where: { id: excess.id },
            data: {
              active: false,
              status: CubicleStatus.INACTIVE,
            },
          });
        }
      }

      await syncFacilityEnabledCubiclesCount(tx as any, id);
    });

    if (this.telemetryService && (dto.isPrimary || existing.isPrimary)) {
      await this.telemetryService.broadcastSnapshot();
    }

    return this.findFacilityDtoOrThrow(id);
  }

  async activate(id: string): Promise<FacilityDto> {
    const target = await this.prisma.facility.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });

    if (!target) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `La sede con id '${id}' no existe.`,
      });
    }

    if (target.status === FacilityStatus.INACTIVE) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: 'No se puede activar una sede en estado Inactiva. Cambie su estado operativo primero.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.facility.updateMany({
        where: { id: { not: id } },
        data: { isPrimary: false },
      });
      await tx.facility.update({
        where: { id },
        data: { isPrimary: true },
      });
    });

    if (this.telemetryService) {
      await this.telemetryService.broadcastSnapshot();
    }

    this.logger.log(`Sede primaria activa conmutada a ${target.code} (${id}).`);
    return this.findFacilityDtoOrThrow(id);
  }

  async assignPharmacist(
    facilityId: string,
    dto: AssignPharmacistToFacilityDto,
  ): Promise<FacilityDto> {
    const [facility, pharmacist] = await Promise.all([
      this.prisma.facility.findUnique({
        where: { id: facilityId },
        select: { id: true, code: true },
      }),
      this.prisma.pharmacist.findUnique({
        where: { id: dto.pharmacistId },
        select: { id: true, userId: true, fullName: true, status: true, cubicleId: true },
      }),
    ]);

    if (!facility) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `La sede con id '${facilityId}' no existe.`,
      });
    }

    if (!pharmacist) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El farmacéutico con id '${dto.pharmacistId}' no existe.`,
      });
    }

    const targetCubicleId = dto.cubicleId ?? null;
    if (targetCubicleId) {
      const targetCubicle = await this.prisma.cubicle.findUnique({
        where: { id: targetCubicleId },
        select: { id: true, facilityId: true },
      });
      if (!targetCubicle) {
        throw new NotFoundException({
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          message: `El cubículo con id '${targetCubicleId}' no existe.`,
        });
      }
      if (targetCubicle.facilityId && targetCubicle.facilityId !== facilityId) {
        throw new BadRequestException({
          code: ApiErrorCode.REQUEST_INVALID,
          message: 'El cubículo indicado no pertenece a esta sede.',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (pharmacist.cubicleId && pharmacist.cubicleId !== targetCubicleId) {
        await tx.cubicle.updateMany({
          where: { id: pharmacist.cubicleId, operatorName: pharmacist.fullName },
          data: { operatorName: null, version: { increment: 1 } },
        });
      }

      if (targetCubicleId) {
        await tx.pharmacist.updateMany({
          where: { cubicleId: targetCubicleId, id: { not: pharmacist.id } },
          data: { cubicleId: null },
        });
      }

      await tx.pharmacist.update({
        where: { id: pharmacist.id },
        data: {
          facilityId,
          cubicleId: targetCubicleId,
        },
      });

      if (targetCubicleId) {
        await tx.cubicle.update({
          where: { id: targetCubicleId },
          data: {
            operatorName:
              pharmacist.status === PharmacistStatus.INACTIVE ? null : pharmacist.fullName,
            version: { increment: 1 },
          },
        });
      }

      await syncUserCubicleLink(tx as any, {
        targetCubicleId,
        linkedUserId: (pharmacist as { userId?: string | null }).userId ?? null,
        shouldOccupyCubicle:
          pharmacist.status !== PharmacistStatus.INACTIVE && Boolean(targetCubicleId),
        clearTargetCubicleOtherUsers: Boolean(targetCubicleId),
        previousCubicleIdToClear:
          pharmacist.cubicleId && pharmacist.cubicleId !== targetCubicleId
            ? pharmacist.cubicleId
            : null,
      });
    });

    if (this.telemetryService) {
      if (pharmacist.cubicleId) {
        await this.telemetryService.emitCubicleUpdate(pharmacist.cubicleId);
      }
      if (targetCubicleId) {
        await this.telemetryService.emitCubicleUpdate(targetCubicleId);
      }
      await this.telemetryService.broadcastSnapshot();
    }

    return this.findFacilityDtoOrThrow(facilityId);
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.prisma.facility.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true },
        },
        cubicles: {
          select: {
            id: true,
            _count: {
              select: {
                tickets: true,
                calls: true,
                statusHistory: true,
                dispensations: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `La sede con id '${id}' no existe.`,
      });
    }

    if (existing.isPrimary) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: 'No se puede eliminar la sede primaria activa. Active otra sede antes de eliminar esta.',
      });
    }

    const facilityTicketsCount =
      (existing as { _count?: { tickets?: number } })._count?.tickets ?? 0;
    if (facilityTicketsCount > 0) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message:
          'No se puede eliminar la sede porque tiene turnos históricos asociados. Cambie su estado a Inactiva.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pharmacist.updateMany({
        where: { facilityId: id },
        data: { facilityId: null, cubicleId: null },
      });

      const txUserDelegate = (tx as { user?: { updateMany?: (...args: any[]) => Promise<any> } }).user;
      if (txUserDelegate?.updateMany && existing.cubicles.length > 0) {
        await txUserDelegate.updateMany({
          where: { cubicleId: { in: existing.cubicles.map((cub) => cub.id) } },
          data: { cubicleId: null },
        });
      }

      for (const cub of existing.cubicles) {
        const hasHistory =
          cub._count.tickets > 0 ||
          cub._count.calls > 0 ||
          cub._count.statusHistory > 0 ||
          cub._count.dispensations > 0;

        if (hasHistory) {
          await tx.cubicle.update({
            where: { id: cub.id },
            data: {
              facilityId: null,
              operatorName: null,
              active: false,
              status: CubicleStatus.INACTIVE,
            },
          });
        } else {
          await tx.cubicle.delete({
            where: { id: cub.id },
          });
        }
      }

      await tx.facility.delete({
        where: { id },
      });
    });

    this.logger.log(`Sede ${existing.code} (${id}) eliminada de forma segura.`);
    return { deleted: true, id };
  }
}

