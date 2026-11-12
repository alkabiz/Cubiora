import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiErrorCode } from '@cubiora/shared';
import { getEnv } from '../../config/env.validation';
import { isOriginAllowed } from '../utils/cors-origin.util';

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guardia global anti-CSRF (defensa en profundidad junto a SameSite=Strict y CORS):
 * Valida Origin / Referer / Sec-Fetch-Site en peticiones mutadoras (`POST`, `PUT`, `PATCH`, `DELETE`),
 * cubriendo incluso Login CSRF (`/auth/login`) y ataques desde subdominios hermanos (`same-site`).
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = (request.method ?? 'GET').toUpperCase();
    if (SAFE_HTTP_METHODS.has(method)) {
      return true;
    }

    const rawSecFetchSite = request.headers?.['sec-fetch-site'];
    const secFetchSite =
      typeof rawSecFetchSite === 'string' ? rawSecFetchSite.trim().toLowerCase() : '';

    if (secFetchSite === 'cross-site') {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Solicitud bloqueada por política anti-CSRF (origen cross-site no permitido).',
      });
    }

    const configuredOrigins = getEnv().CORS_ORIGINS;
    const rawOrigin = request.headers?.['origin'];
    const originHeader = typeof rawOrigin === 'string' ? rawOrigin.trim() : '';

    if (originHeader.length > 0) {
      if (originHeader.toLowerCase() === 'null') {
        throw new ForbiddenException({
          code: ApiErrorCode.FORBIDDEN,
          message: 'Solicitud bloqueada por política anti-CSRF (Origin nulo).',
        });
      }

      if (!isOriginAllowed(originHeader, configuredOrigins)) {
        throw new ForbiddenException({
          code: ApiErrorCode.FORBIDDEN,
          message: 'Solicitud bloqueada por política anti-CSRF (Origin no autorizado).',
        });
      }

      return true;
    }

    const rawReferer = request.headers?.['referer'];
    const refererHeader = typeof rawReferer === 'string' ? rawReferer.trim() : '';
    if (refererHeader.length > 0) {
      if (!isOriginAllowed(refererHeader, configuredOrigins)) {
        throw new ForbiddenException({
          code: ApiErrorCode.FORBIDDEN,
          message: 'Solicitud bloqueada por política anti-CSRF (Referer no autorizado).',
        });
      }
      return true;
    }

    if (secFetchSite === 'same-site') {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Solicitud bloqueada por política anti-CSRF (subdominio hermano sin Origin autorizado).',
      });
    }

    return true;
  }
}

