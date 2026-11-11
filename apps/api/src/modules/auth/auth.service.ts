import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionTokenUtil } from './session-token.util';
import { getEnv } from '../../config/env.validation';
import { UserRole, ApiErrorCode } from '@cubiora/shared';

export interface LoginResult {
  token: string;
  user: {
    publicId: string;
    username: string;
    displayName: string;
    role: UserRole;
    cubicleId: string | null;
    cubicleCode: string | null;
    cubicleDisplayName: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida credenciales contra la base de datos y emite token de sesión seguro.
   */
  async login(username: string, pass: string): Promise<LoginResult> {
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!normalizedUsername || !pass) {
      throw new BadRequestException({
        code: ApiErrorCode.REQUEST_INVALID,
        message: 'Usuario y contraseña son requeridos',
      });
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { username: normalizedUsername },
        include: {
          cubicle: {
            select: {
              id: true,
              code: true,
              displayName: true,
            },
          },
        },
      });

      if (!user || !user.active) {
        throw new UnauthorizedException({
          code: ApiErrorCode.AUTH_REQUIRED,
          message: 'Credenciales inválidas o usuario inactivo',
        });
      }

      if (!user.passwordHash || typeof user.passwordHash !== 'string') {
        this.logger.warn(
          `Intento de login fallido para '${normalizedUsername}': hash de contraseña ausente o inválido.`,
        );
        throw new UnauthorizedException({
          code: ApiErrorCode.AUTH_REQUIRED,
          message: 'Credenciales inválidas o usuario inactivo',
        });
      }

      let isMatch = false;
      try {
        isMatch = await bcrypt.compare(pass, user.passwordHash);
      } catch (hashError) {
        this.logger.warn(
          `Error verificando hash bcrypt para '${normalizedUsername}': ${
            hashError instanceof Error ? hashError.message : String(hashError)
          }`,
        );
        throw new UnauthorizedException({
          code: ApiErrorCode.AUTH_REQUIRED,
          message: 'Credenciales inválidas o usuario inactivo',
        });
      }

      if (!isMatch) {
        throw new UnauthorizedException({
          code: ApiErrorCode.AUTH_REQUIRED,
          message: 'Credenciales inválidas o usuario inactivo',
        });
      }

      const cubicleCode = user.cubicle?.code ?? null;
      const cubicleDisplayName = user.cubicle?.displayName ?? null;

      const env = getEnv();
      const token = SessionTokenUtil.sign(
        {
          sub: user.id,
          publicId: user.publicId,
          username: user.username,
          displayName: user.displayName,
          role: user.role as UserRole,
          cubicleId: user.cubicleId,
          cubicleCode,
        },
        env.SESSION_SECRET,
      );

      return {
        token,
        user: {
          publicId: user.publicId,
          username: user.username,
          displayName: user.displayName,
          role: user.role as UserRole,
          cubicleId: user.cubicleId,
          cubicleCode,
          cubicleDisplayName,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Error inesperado en AuthService.login para '${normalizedUsername}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Obtiene la información fresca del usuario autenticado.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        publicId: true,
        username: true,
        displayName: true,
        role: true,
        cubicleId: true,
        cubicle: {
          select: {
            code: true,
            displayName: true,
          },
        },
        active: true,
        createdAt: true,
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException({
        code: ApiErrorCode.AUTH_REQUIRED,
        message: 'Usuario no encontrado o inactivo',
      });
    }

    return {
      publicId: user.publicId,
      username: user.username,
      displayName: user.displayName,
      role: user.role as UserRole,
      cubicleId: user.cubicleId,
      cubicleCode: user.cubicle?.code ?? null,
      cubicleDisplayName: user.cubicle?.displayName ?? null,
      createdAt: user.createdAt,
    };
  }
}
