import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiErrorCode } from '@cubiora/shared';
import { getEnv } from '../../config/env.validation';

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseAllowedOriginSet(rawOrigins: string): Set<string> {
  const result = new Set<string>();
  for (const entry of rawOrigins.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed === '*') continue;
    try {
      result.add(new URL(trimmed).origin);
    } catch {
      // Ignorar entradas malformadas
    }
  }
  return result;
}

function extractOriginFromUrl(rawValue: string): string | null {
  try {
    return new URL(rawValue).origin;
  } catch {
    return null;
  }
}

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

    const allowedOrigins = parseAllowedOriginSet(getEnv().CORS_ORIGINS);
    const rawOrigin = request.headers?.['origin'];
    const originHeader = typeof rawOrigin === 'string' ? rawOrigin.trim() : '';

    if (originHeader.length > 0) {
      if (originHeader.toLowerCase() === 'null') {
        throw new ForbiddenException({
          code: ApiErrorCode.FORBIDDEN,
          message: 'Solicitud bloqueada por política anti-CSRF (Origin nulo).',
        });
      }

      const parsedOrigin = extractOriginFromUrl(originHeader);
      if (!parsedOrigin || !allowedOrigins.has(parsedOrigin)) {
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
      const parsedRefererOrigin = extractOriginFromUrl(refererHeader);
      if (!parsedRefererOrigin || !allowedOrigins.has(parsedRefererOrigin)) {
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

