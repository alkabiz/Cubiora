import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ulid } from 'ulid';
import { AdminUserDto, ApiErrorCode, UserRole } from '@cubiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
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

  constructor(private readonly prisma: PrismaService) {}

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

    const cubicleId = dto.cubicleId ?? null;
    if (cubicleId) {
      await this.ensureCubicleAvailable(cubicleId);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const id = ulid();
    const publicId = ulid();

    try {
      const created = await this.prisma.user.create({
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

    if (dto.cubicleId !== undefined && dto.cubicleId !== null) {
      await this.ensureCubicleAvailable(dto.cubicleId, existing.id);
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.cubicleId !== undefined ? { cubicleId: dto.cubicleId } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
        select: SAFE_USER_SELECT,
      });

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
      data: { passwordHash },
    });

    this.logger.log(`Contraseña restablecida administrativamente para '${existing.username}'.`);
    return {
      reset: true,
      id: existing.id,
      username: existing.username,
    };
  }
}

