import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';

export interface ItemView {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  qtyOnHand: number;
  isLow: boolean;
  createdAt: Date;
}

export interface ItemLocationQty {
  locationId: string;
  name: string;
  zone: string;
  qty: number;
}

export interface ItemDetailView extends ItemView {
  locations: ItemLocationQty[];
}

/** Row shape returned by the queries below — item plus its per-location rows. */
type ItemWithStock = Prisma.ItemGetPayload<{
  include: { stockLevels: { include: { location: true } } };
}>;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * On-hand is always derived: SUM(stockLevel.qty). Nothing is denormalised onto
   * Item, so a balance can never drift from the movement ledger that produced it.
   */
  private toView(item: ItemWithStock): ItemView {
    const qtyOnHand = item.stockLevels.reduce((sum, row) => sum + row.qty, 0);
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      unit: item.unit,
      reorderAt: item.reorderAt,
      qtyOnHand,
      isLow: qtyOnHand <= item.reorderAt,
      createdAt: item.createdAt,
    };
  }

  async findAll(query: QueryItemsDto): Promise<ItemView[]> {
    const q = query.q?.trim();
    const where: Prisma.ItemWhereInput = q
      ? {
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const items = await this.prisma.item.findMany({
      where,
      include: { stockLevels: { include: { location: true } } },
      orderBy: { sku: 'asc' },
    });

    const views = items.map((item) => this.toView(item));
    // `lowStock` filters on the derived total, so it cannot be pushed into SQL
    // without giving up the "balances live in StockLevel" invariant.
    return query.lowStock ? views.filter((view) => view.isLow) : views;
  }

  async findOne(id: string): Promise<ItemDetailView> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { stockLevels: { include: { location: true } } },
    });
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const locations: ItemLocationQty[] = item.stockLevels
      .map((row) => ({
        locationId: row.locationId,
        name: row.location.name,
        zone: row.location.zone,
        qty: row.qty,
      }))
      .sort((a, b) =>
        a.zone === b.zone
          ? a.name.localeCompare(b.name)
          : a.zone.localeCompare(b.zone),
      );

    return { ...this.toView(item), locations };
  }

  async create(dto: CreateItemDto): Promise<ItemView> {
    try {
      const item = await this.prisma.item.create({
        data: {
          sku: dto.sku.trim(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          unit: dto.unit?.trim() || 'unit',
          reorderAt: dto.reorderAt ?? 0,
        },
        include: { stockLevels: { include: { location: true } } },
      });
      return this.toView(item);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateItemDto): Promise<ItemView> {
    await this.requireItem(id);
    try {
      const item = await this.prisma.item.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit.trim() || 'unit' } : {}),
          ...(dto.reorderAt !== undefined ? { reorderAt: dto.reorderAt } : {}),
        },
        include: { stockLevels: { include: { location: true } } },
      });
      return this.toView(item);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /**
   * Deleting an item that history references would orphan the audit trail, so
   * it is refused with a 409 rather than cascading. The DB enforces the same
   * rule via `onDelete: Restrict`; this check exists to give a readable message.
   */
  async remove(id: string): Promise<{ id: string }> {
    await this.requireItem(id);

    const [movements, stock] = await Promise.all([
      this.prisma.movement.count({ where: { itemId: id } }),
      this.prisma.stockLevel.count({ where: { itemId: id, qty: { not: 0 } } }),
    ]);
    if (movements > 0) {
      throw new ConflictException(
        'This item has recorded movements and cannot be deleted',
      );
    }
    if (stock > 0) {
      throw new ConflictException(
        'This item still holds stock and cannot be deleted',
      );
    }

    await this.prisma.stockLevel.deleteMany({ where: { itemId: id } });
    await this.prisma.item.delete({ where: { id } });
    return { id };
  }

  private async requireItem(id: string): Promise<void> {
    const exists = await this.prisma.item.count({ where: { id } });
    if (exists === 0) {
      throw new NotFoundException('Item not found');
    }
  }

  /** P2002 on `sku` is a user-correctable form error, not a server fault. */
  private mapWriteError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new BadRequestException('SKU already exists');
    }
    return error;
  }
}
