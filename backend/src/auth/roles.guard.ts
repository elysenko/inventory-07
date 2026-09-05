import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';

/** ADMIN is a superset of MANAGER, so it satisfies every manager-level check. */
const IMPLIED: Record<Role, Role[]> = {
  USER: [Role.USER],
  MANAGER: [Role.MANAGER, Role.USER],
  ADMIN: [Role.ADMIN, Role.MANAGER, Role.USER],
};

/**
 * Second APP_GUARD, evaluated after JwtAuthGuard has populated `request.user`.
 * Routes without `@Roles(...)` are open to any authenticated caller.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const role = request.user?.role;
    if (!role) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const granted = IMPLIED[role] ?? [role];
    if (!required.some((needed) => granted.includes(needed))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
