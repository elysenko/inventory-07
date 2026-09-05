import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

export interface LocationView {
  id: string;
  name: string;
  zone: string;
  itemCount: number;
  totalQty: number;
  createdAt: Date;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `itemCount` counts distinct items actually holding stock here (qty != 0),
   * so an emptied-out StockLevel row does not make a location look occupied.
   */
  async findAll(): Promise<LocationView[]> {
    const locations = await this.prisma.location.findMany({
      include: { stockLevels: { select: { qty: true } } },
      orderBy: [{ zone: 'asc' }, { name: 'asc' }],
    });

    return locations.map((location) => ({
      id: location.id,
      name: location.name,
      zone: location.zone,
      itemCount: location.stockLevels.filter((row) => row.qty !== 0).length,
      totalQty: location.stockLevels.reduce((sum, row) => sum + row.qty, 0),
      createdAt: location.createdAt,
    }));
  }

  async findOne(id: string): Promise<LocationView> {
    const found = (await this.findAll()).find((location) => location.id === id);
    if (!found) {
      throw new NotFoundException('Location not found');
    }
    return found;
  }

  async create(dto: CreateLocationDto): Promise<LocationView> {
    try {
      const created = await this.prisma.location.create({
        data: { name: dto.name.trim(), zone: dto.zone.trim() },
      });
      return { ...created, itemCount: 0, totalQty: 0 };
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationView> {
    await this.requireLocation(id);
    try {
      await this.prisma.location.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.zone !== undefined ? { zone: dto.zone.trim() } : {}),
        },
      });
      return this.findOne(id);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /** Blocked whenever history or a non-zero balance points at this location. */
  async remove(id: string): Promise<{ id: string }> {
    await this.requireLocation(id);

    const [movements, stock] = await Promise.all([
      this.prisma.movement.count({
        where: { OR: [{ fromLocId: id }, { toLocId: id }] },
      }),
      this.prisma.stockLevel.count({
        where: { locationId: id, qty: { not: 0 } },
      }),
    ]);
    if (movements > 0) {
      throw new ConflictException(
        'This location has recorded movements and cannot be deleted',
      );
    }
    if (stock > 0) {
      throw new ConflictException(
        'This location still holds stock and cannot be deleted',
      );
    }

    await this.prisma.stockLevel.deleteMany({ where: { locationId: id } });
    await this.prisma.location.delete({ where: { id } });
    return { id };
  }

  private async requireLocation(id: string): Promise<void> {
    const exists = await this.prisma.location.count({ where: { id } });
    if (exists === 0) {
      throw new NotFoundException('Location not found');
    }
  }

  /** The composite unique is (name, zone), so the clash message names both. */
  private mapWriteError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new BadRequestException(
        'A location with that name already exists in this zone',
      );
    }
    return error;
  }
}
