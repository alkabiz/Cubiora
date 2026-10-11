import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole, ApiErrorCode } from '@cubiora/shared';

/**
 * RolesGuard — Control de acceso basado en roles (RBAC).
 * 
 * Reglas mandatorias:
 * 1. Denegación por defecto: Cualquier ruta no marcada con @Public() DEBE
 *    especificar explícitamente los roles permitidos mediante @Roles().
 *    Si no especifica roles, el acceso se deniega categóricamente (403 Forbidden).
 * 2. Caja limitada a su cubículo: Los usuarios con rol CASHIER están estrictamente
 *    restringidos a operar en su cubículo asignado. Cualquier intento de intervenir
 *    en un cubículo ajeno se rechaza con 403 Forbidden.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Si la ruta es expresamente pública, no aplica restricción de roles
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Denegación por defecto: Si no se declararon roles explícitos, denegar
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Acceso denegado: este endpoint no tiene roles asignados y aplica denegación por defecto.',
      });
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Acceso denegado: usuario no autenticado o sin rol asignado.',
      });
    }

    // 3. Verificar si el rol del usuario está autorizado
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: `Acceso denegado: se requiere uno de los roles [${requiredRoles.join(', ')}], rol actual: ${user.role}.`,
      });
    }

    // 4. Regla de negocio: Caja limitada exclusivamente a su cubículo asignado
    if (user.role === UserRole.CASHIER) {
      const requestedCubicleId =
        request.params?.cubicleId ??
        request.query?.cubicleId ??
        request.body?.cubicleId;

      if (requestedCubicleId && user.cubicleId && requestedCubicleId !== user.cubicleId) {
        throw new ForbiddenException({
          code: ApiErrorCode.FORBIDDEN,
          message: `Acceso denegado: El operador de caja está restringido a su cubículo (${user.cubicleId}) y no puede operar en el cubículo (${requestedCubicleId}).`,
        });
      }
    }

    return true;
  }
}

