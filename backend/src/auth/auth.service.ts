import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, JwtPayload } from './auth-user';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

/** Must match prisma/seed/seed.js so platform-minted logins verify here. */
const BCRYPT_ROUNDS = 10;

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Self-service registration always mints a `USER` (stock clerk). Manager and
   * admin logins are platform-owned and arrive through the seed, so there is no
   * path here to escalate a role.
   */
  async signup(dto: SignupDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name?.trim() || null,
          passwordHash,
          role: Role.USER,
        },
        select: { id: true, email: true, name: true, role: true },
      });
      return this.issue(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('That email address is already registered');
      }
      throw error;
    }
  }

  /**
   * Deliberately uniform failure: an unknown email and a wrong password both
   * return the same 401 so the endpoint cannot be used to enumerate accounts.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issue({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  async me(id: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    return user;
  }

  private issue(user: AuthUser): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return { accessToken: this.jwt.sign(payload), user };
  }
}
