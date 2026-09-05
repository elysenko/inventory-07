import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to the listed roles. Read by RolesGuard, which treats ADMIN
 * as satisfying any MANAGER requirement, so `@Roles(Role.MANAGER)` is enough
 * for "manager or above".
 */
export const Roles = (...roles: Role[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
