import { Role } from '@prisma/client';

/** The JWT-derived caller attached to `request.user` by JwtStrategy.validate(). */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/** Claims we sign. `sub` is the user id, per JWT convention. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
