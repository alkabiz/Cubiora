import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@cubiora/shared';

/**
 * RolesGuard — Esqueleto inicial.
 * Deniega por defecto cualquier petición a rutas con @Roles si la autenticación
 * aún no ha validado un usuario con el rol requerido.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta no especifica roles, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      // Denegar por defecto si no hay usuario autenticado
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}
