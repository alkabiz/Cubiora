import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ulid } from 'ulid';
import { AdminUserDto, ApiErrorCode, UserRole } from '@cubiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  lockCubicleRows,
  resolveEffectiveOperatorName,
} from '../../common/utils/cubicle-assignment-sync.util';
import { OperationalTelemetryService } from '../operational-telemetry/operational-telemetry.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SAFE_USER_SELECT = {
  id: true,
  publicId: true,
  username: true,
  displayName: true,
  role: true,
  cubicleId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  cubicle: {
    select: {
      code: true,
      displayName: true,
    },
  },
} as const;

type SafeUserRow = {
  id: string;
  publicId: string;
  username: string;
  displayName: string;
  role: string;
  cubicleId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  cubicle?: {
    code: string;
    displayName: string;
  } | null;
};

export interface ListUsersFilter {
  search?: string | undefined;
  role?: string | undefined;
  active?: boolean | undefined;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly telemetryService?: OperationalTelemetryService,
  ) {}

  private async emitTelemetrySafe(cubicleIds: Array<string | null | undefined>): Promise<void> {
    if (!this.telemetryService) return;
    const uniqueIds = Array.from(
      new Set(cubicleIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    );
    if (uniqueIds.length === 0) return;
    try {
      for (const cubicleId of uniqueIds) {
        await this.telemetryService.emitCubicleUpdate(cubicleId);
      }
      await this.telemetryService.broadcastSnapshot();
    } catch (err) {
      this.logger.warn(`No se pudo emitir telemetría tras cambio en usuario: ${(err as Error).message}`);
    }
  }

  private async recomputeCubicleOperatorName(
    tx: any,
    cubicleId: string | null | undefined,
  ): Promise<void> {
    if (!cubicleId || !tx.cubicle?.findUnique || !tx.cubicle?.update) {
      return;
    }

    const cub = await tx.cubicle.findUnique({
      where: { id: cubicleId },
      select: {
        id: true,
        currentOperator: {
          select: { displayName: true, role: true, active: true },
        },
        pharmacists: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { fullName: true, status: true },
        },
      },
    });

    if (!cub) return;

    const effectiveName = resolveEffectiveOperatorName({
      pharmacists: cub.pharmacists,
      currentOperator: cub.currentOperator,
      legacyOperatorName: null,
    });

    await tx.cubicle.update({
      where: { id: cubicleId },
      data: {
        operatorName: effectiveName,
        version: { increment: 1 },
      },
    });
  }

  private mapToDto(row: SafeUserRow): AdminUserDto {
    return {
      id: row.id,
      publicId: row.publicId,
      username: row.username,
      displayName: row.displayName,
      role: row.role as UserRole,
      cubicleId: row.cubicleId ?? null,
      cubicleCode: row.cubicle?.code ?? null,
      cubicleDisplayName: row.cubicle?.displayName ?? null,
      active: row.active,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async findAll(filters: ListUsersFilter = {}): Promise<AdminUserDto[]> {
    const where: Record<string, unknown> = {};

    const search = filters.search?.trim();
    if (search && search.length > 0) {
      where['OR'] = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (
      filters.role &&
      filters.role !== 'ALL' &&
      Object.values(UserRole).includes(filters.role as UserRole)
    ) {
      where['role'] = filters.role as UserRole;
    }

    if (filters.active !== undefined) {
      where['active'] = filters.active;
    }

    const rows = await this.prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    });

    return rows.map((row) => this.mapToDto(row as unknown as SafeUserRow));
  }

  private async ensureCubicleAvailable(
    cubicleId: string,
    excludeUserId?: string,
  ): Promise<void> {
    const cubicle = await this.prisma.cubicle.findUnique({
      where: { id: cubicleId },
      select: { id: true, code: true },
    });

    if (!cubicle) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `El cubículo con id '${cubicleId}' no existe.`,
      });
    }

    const conflictUser = await this.prisma.user.findFirst({
      where: {
        cubicleId,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true, username: true, displayName: true },
    });

    if (conflictUser) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `El cubículo ${cubicle.code} ya está asignado a la cuenta '${conflictUser.username}'. Desvincúlelo antes de reasignarlo.`,
      });
    }
  }

  async create(dto: CreateUserDto): Promise<AdminUserDto> {
    const normalizedUsername = dto.username.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `Ya existe una cuenta con el usuario '${normalizedUsername}'.`,
      });
    }

    const targetActive = dto.active ?? true;
    const cubicleId = dto.cubicleId ?? null;
    if (cubicleId && (dto.role !== UserRole.CASHIER || targetActive === false)) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: 'Solo las cuentas activas con rol CASHIER pueden asignarse a un cubículo.',
      });
    }
    if (cubicleId) {
      await this.ensureCubicleAvailable(cubicleId);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const id = ulid();
    const publicId = ulid();
    const hasTransactionalSync =
      typeof (this.prisma as { $transaction?: unknown }).$transaction === 'function' &&
      Boolean((this.prisma as { pharmacist?: unknown }).pharmacist) &&
      typeof (this.prisma.cubicle as { update?: unknown })?.update === 'function';

    try {
      const created = hasTransactionalSync
        ? await this.prisma.$transaction(async (tx) => {
            if (cubicleId) {
              await lockCubicleRows(tx, [cubicleId]);
            }

            const persisted = await tx.user.create({
              data: {
                id,
                publicId,
                username: normalizedUsername,
                displayName: dto.displayName.trim(),
                passwordHash,
                role: dto.role,
                cubicleId,
                active: targetActive,
              },
              select: SAFE_USER_SELECT,
            });

            if (persisted.cubicleId) {
              await this.recomputeCubicleOperatorName(tx, persisted.cubicleId);
            }

            return persisted;
          })
        : await this.prisma.user.create({
            data: {
              id,
              publicId,
              username: normalizedUsername,
              displayName: dto.displayName.trim(),
              passwordHash,
              role: dto.role,
              cubicleId,
              active: dto.active ?? true,
            },
            select: SAFE_USER_SELECT,
          });

      await this.emitTelemetrySafe([created.cubicleId]);
      this.logger.log(`Cuenta operativa creada: ${created.username} (${created.role})`);
      return this.mapToDto(created as unknown as SafeUserRow);
    } catch (err: unknown) {
      const prismaCode = (err as { code?: string })?.code;
      if (prismaCode === 'P2002') {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: `El usuario o el cubículo seleccionado ya se encuentra en uso.`,
        });
      }
      throw err;
    }
  }

  async update(
    idOrPublicId: string,
    dto: UpdateUserDto,
    actorUser?: AuthenticatedUser,
  ): Promise<AdminUserDto> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }],
      },
      select: {
        id: true,
        publicId: true,
        username: true,
        displayName: true,
        role: true,
        cubicleId: true,
        active: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `La cuenta de usuario '${idOrPublicId}' no existe.`,
      });
    }

    const isSelf =
      actorUser !== undefined &&
      (existing.id === actorUser.id || existing.publicId === actorUser.publicId);

    if (isSelf) {
      if (dto.active === false) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: 'No puede desactivar su propia cuenta mientras está en sesión activa.',
        });
      }
      if (dto.role !== undefined && dto.role !== UserRole.ADMIN) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: 'No puede revocar su propio rol de administrador.',
        });
      }
    }

    const nextRole = dto.role ?? (existing.role as UserRole);
    const nextActive = dto.active ?? existing.active;

    if (
      dto.cubicleId !== undefined &&
      dto.cubicleId !== null &&
      (nextRole !== UserRole.CASHIER || nextActive === false)
    ) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: 'Solo las cuentas activas con rol CASHIER pueden permanecer asignadas a un cubículo.',
      });
    }

    const effectiveCubicleIdPatch: string | null | undefined =
      dto.cubicleId !== undefined
        ? dto.cubicleId
        : (nextRole !== UserRole.CASHIER || nextActive === false) && existing.cubicleId !== null
          ? null
          : undefined;

    if (effectiveCubicleIdPatch !== undefined && effectiveCubicleIdPatch !== null) {
      await this.ensureCubicleAvailable(effectiveCubicleIdPatch, existing.id);
    }

    const shouldRevokeSessions =
      dto.active === false ||
      (dto.role !== undefined && dto.role !== existing.role);

    const hasTransactionalSync =
      typeof (this.prisma as { $transaction?: unknown }).$transaction === 'function' &&
      Boolean((this.prisma as { pharmacist?: unknown }).pharmacist) &&
      typeof (this.prisma.cubicle as { update?: unknown })?.update === 'function';

    try {
      if (hasTransactionalSync) {
        const { updated, affectedCubicleIds } = await this.prisma.$transaction(async (tx) => {
          await lockCubicleRows(tx, [
            existing.cubicleId,
            effectiveCubicleIdPatch === undefined ? null : effectiveCubicleIdPatch,
          ]);

          const persisted = await tx.user.update({
            where: { id: existing.id },
            data: {
              ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
              ...(dto.role !== undefined ? { role: dto.role } : {}),
              ...(effectiveCubicleIdPatch !== undefined
                ? { cubicleId: effectiveCubicleIdPatch }
                : {}),
              ...(dto.active !== undefined ? { active: dto.active } : {}),
              ...(shouldRevokeSessions ? { tokenVersion: { increment: 1 } } : {}),
            },
            select: SAFE_USER_SELECT,
          });

          const linkedPharmacist = await tx.pharmacist.findUnique({
            where: { userId: existing.id },
            select: {
              id: true,
              fullName: true,
              cubicleId: true,
              facilityId: true,
            },
          });

          const touchedCubicles = new Set<string>();
          if (existing.cubicleId) touchedCubicles.add(existing.cubicleId);
          if (persisted.cubicleId) touchedCubicles.add(persisted.cubicleId);
          if (linkedPharmacist?.cubicleId) touchedCubicles.add(linkedPharmacist.cubicleId);

          if (linkedPharmacist) {
            const pharmacistPatch: Record<string, unknown> = {};
            const finalUserCubicleId = persisted.cubicleId ?? null;

            if (
              effectiveCubicleIdPatch !== undefined &&
              finalUserCubicleId !== linkedPharmacist.cubicleId
            ) {
              if (finalUserCubicleId === null) {
                pharmacistPatch['cubicleId'] = null;
              } else {
                const targetCubicle = await tx.cubicle.findUnique({
                  where: { id: finalUserCubicleId },
                  select: { id: true, facilityId: true },
                });
                await tx.pharmacist.updateMany({
                  where: { cubicleId: finalUserCubicleId, id: { not: linkedPharmacist.id } },
                  data: { cubicleId: null },
                });
                pharmacistPatch['cubicleId'] = finalUserCubicleId;
                if (targetCubicle) {
                  pharmacistPatch['facilityId'] = targetCubicle.facilityId ?? null;
                }
              }
            }

            const previousDisplayName = (existing as { displayName?: string }).displayName;
            if (
              dto.displayName !== undefined &&
              previousDisplayName !== undefined &&
              linkedPharmacist.fullName === previousDisplayName &&
              persisted.displayName !== linkedPharmacist.fullName
            ) {
              pharmacistPatch['fullName'] = persisted.displayName;
            }

            if (Object.keys(pharmacistPatch).length > 0) {
              await tx.pharmacist.update({
                where: { id: linkedPharmacist.id },
                data: pharmacistPatch,
              });
            }
          }

          const affectedList = Array.from(touchedCubicles);
          for (const cubId of affectedList) {
            await this.recomputeCubicleOperatorName(tx, cubId);
          }

          return {
            updated: persisted,
            affectedCubicleIds: affectedList,
          };
        });

        if (shouldRevokeSessions) {
          this.telemetryService?.notifyUserSessionRevoked?.(existing.id);
        }
        await this.emitTelemetrySafe(affectedCubicleIds);
        this.logger.log(`Cuenta operativa actualizada: ${updated.username}`);
        return this.mapToDto(updated as unknown as SafeUserRow);
      }

      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(effectiveCubicleIdPatch !== undefined
            ? { cubicleId: effectiveCubicleIdPatch }
            : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(shouldRevokeSessions ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: SAFE_USER_SELECT,
      });

      if (shouldRevokeSessions) {
        this.telemetryService?.notifyUserSessionRevoked?.(existing.id);
      }

      this.logger.log(`Cuenta operativa actualizada: ${updated.username}`);
      return this.mapToDto(updated as unknown as SafeUserRow);
    } catch (err: unknown) {
      const prismaCode = (err as { code?: string })?.code;
      if (prismaCode === 'P2002') {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: 'El cubículo seleccionado ya está asignado a otra cuenta.',
        });
      }
      throw err;
    }
  }

  async resetPassword(
    idOrPublicId: string,
    newPassword: string,
  ): Promise<{ reset: true; id: string; username: string }> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }],
      },
      select: { id: true, username: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `La cuenta de usuario '${idOrPublicId}' no existe.`,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    this.telemetryService?.notifyUserSessionRevoked?.(existing.id);
    this.logger.log(`Contraseña restablecida administrativamente para '${existing.username}'.`);
    return {
      reset: true,
      id: existing.id,
      username: existing.username,
    };
  }
}

