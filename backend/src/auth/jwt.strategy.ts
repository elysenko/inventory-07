import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, JwtPayload } from './auth-user';

/** Fallback only for local `npm run start:dev`; deployments always inject JWT_SECRET. */
export const JWT_SECRET = process.env.JWT_SECRET ?? 'stockroom-dev-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
      algorithms: ['HS256'],
    });
  }

  /**
   * Re-read the user on every request rather than trusting the token's claims:
   * a role change or a deleted account takes effect immediately instead of
   * lingering until the 12h token expires.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    return user;
  }
}
