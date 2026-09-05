import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Boots the real application (global guards, global pipe, `api` prefix) against
 * the configured DATABASE_URL. Every fixture is namespaced by `run`, a value
 * unique to this process, so the suite is safe to run against a shared database
 * and leaves nothing behind — `teardown()` deletes exactly what it created.
 */
export class Harness {
  app!: INestApplication;
  prisma!: PrismaService;
  readonly run = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  private readonly userIds: string[] = [];
  private readonly itemIds: string[] = [];
  private readonly locationIds: string[] = [];

  async setup(): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleRef.createNestApplication();
    this.app.setGlobalPrefix('api');
    this.app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await this.app.init();
    this.prisma = this.app.get(PrismaService);
  }

  get server(): unknown {
    return this.app.getHttpServer();
  }

  /** Creates a user at the given role and returns a usable bearer token. */
  async signIn(role: Role): Promise<string> {
    const email = `${role.toLowerCase()}.${this.run}@example.test`;
    const password = 'HarnessPass123!';
    const user = await this.prisma.user.create({
      data: {
        email,
        name: `${role} ${this.run}`,
        role,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    this.userIds.push(user.id);

    const jwt = this.app.get<{ sign: (p: object) => string }>(
      (await import('@nestjs/jwt')).JwtService,
    );
    return jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  async createItem(overrides: Partial<{ sku: string; name: string; reorderAt: number }> = {}) {
    const item = await this.prisma.item.create({
      data: {
        sku: overrides.sku ?? `SKU-${this.run}-${this.itemIds.length}`,
        name: overrides.name ?? `Item ${this.itemIds.length}`,
        unit: 'unit',
        reorderAt: overrides.reorderAt ?? 0,
      },
    });
    this.itemIds.push(item.id);
    return item;
  }

  async createLocation(zone: string) {
    const location = await this.prisma.location.create({
      data: { name: `Rack ${this.run}`, zone },
    });
    this.locationIds.push(location.id);
    return location;
  }

  /** Order matters: movements and stock levels reference items/locations/users. */
  async teardown(): Promise<void> {
    await this.prisma.movement.deleteMany({
      where: {
        OR: [
          { itemId: { in: this.itemIds } },
          { userId: { in: this.userIds } },
        ],
      },
    });
    await this.prisma.stockLevel.deleteMany({
      where: {
        OR: [
          { itemId: { in: this.itemIds } },
          { locationId: { in: this.locationIds } },
        ],
      },
    });
    await this.prisma.item.deleteMany({ where: { id: { in: this.itemIds } } });
    await this.prisma.location.deleteMany({
      where: { id: { in: this.locationIds } },
    });
    await this.prisma.user.deleteMany({ where: { id: { in: this.userIds } } });
    await this.app.close();
  }
}
