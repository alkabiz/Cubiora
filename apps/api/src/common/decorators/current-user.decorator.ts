import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@cubiora/shared';

export interface AuthenticatedUser {
  id: string;
  publicId: string;
  username: string;
  displayName: string;
  role: UserRole;
  cubicleId: string | null;
}

/**
 * Decorador para inyectar los datos del usuario autenticado en los controladores.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    return data ? user?.[data] : user;
  },
);
