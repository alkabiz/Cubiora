import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
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
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida credenciales contra la base de datos y emite token de sesión seguro.
   */
  async login(username: string, pass: string): Promise<LoginResult> {
    if (!username || !pass) {
      throw new BadRequestException({
        code: ApiErrorCode.REQUEST_INVALID,
        message: 'Usuario y contraseña son requeridos',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException({
        code: ApiErrorCode.AUTH_REQUIRED,
        message: 'Credenciales inválidas o usuario inactivo',
      });
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({
        code: ApiErrorCode.AUTH_REQUIRED,
        message: 'Credenciales inválidas o usuario inactivo',
      });
    }

    const env = getEnv();
    const token = SessionTokenUtil.sign(
      {
        sub: user.id,
        publicId: user.publicId,
        username: user.username,
        displayName: user.displayName,
        role: user.role as UserRole,
        cubicleId: user.cubicleId,
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
      },
    };
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
      createdAt: user.createdAt,
    };
  }
}
