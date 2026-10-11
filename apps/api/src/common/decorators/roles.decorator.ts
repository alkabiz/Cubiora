import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@cubiora/shared';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir endpoints según roles de usuario.
 * @example @Roles(UserRole.ADMIN, UserRole.CASHIER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
