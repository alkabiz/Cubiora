import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionTokenUtil } from '../../modules/auth/session-token.util';
import { getEnv } from '../../config/env.validation';
import { ApiErrorCode } from '@cubiora/shared';
import { PrismaService } from '../../prisma/prisma.service';

import { AuthenticatedUser } from '../decorators/current-user.decorator';
import type { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    const env = getEnv();

    if (!token) {
      throw new UnauthorizedException({
        code: ApiErrorCode.AUTH_REQUIRED,
        message: 'Sesión no iniciada. Autenticación requerida.',
      });
    }

    const payload = SessionTokenUtil.verify(token, env.SESSION_SECRET);

    if (!payload) {
      throw new UnauthorizedException({
        code: ApiErrorCode.AUTH_REQUIRED,
        message: 'Sesión inválida o expirada. Por favor inicie sesión nuevamente.',
      });
    }

    // Validación de usuario inactivo (en token)
    if (
      (payload as unknown as { status?: string }).status === 'INACTIVE' ||
      (payload as unknown as { active?: boolean }).active === false
    ) {
      throw new UnauthorizedException({
        code: ApiErrorCode.AUTH_REQUIRED,
        message: 'Acceso denegado: el usuario se encuentra inactivo.',
      });
    }

    const attachUser = () => {
      (request as unknown as { user: AuthenticatedUser }).user = {
        id: payload.sub,
        publicId: payload.publicId,
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
        cubicleId: payload.cubicleId,
      };
      return true;
    };

    if (this.prisma?.user?.findUnique) {
      return this.prisma.user
        .findUnique({
          where: { id: payload.sub },
          select: { active: true },
        })
        .then((dbUser) => {
          if (dbUser && !dbUser.active) {
            throw new UnauthorizedException({
              code: ApiErrorCode.AUTH_REQUIRED,
              message: 'Acceso denegado: el usuario se encuentra inactivo.',
            });
          }
          return attachUser();
        });
    }

    return attachUser();
  }

  private extractToken(request: Request): string | null {
    // 1. Prioridad: Cookie segura cubiora_session (cookie firmada o cruda)
    if (request.signedCookies?.['cubiora_session']) {
      return request.signedCookies['cubiora_session'];
    }
    if (request.cookies?.['cubiora_session']) {
      return request.cookies['cubiora_session'];
    }

    // 2. Soporte fallback para tests automatizados vía header Authorization: Bearer <token>
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}
