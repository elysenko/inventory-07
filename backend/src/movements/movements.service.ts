import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';

export const PAGE_SIZE = 50;

export interface MovementView {
  id: string;
  type: MovementType;
  itemId: string;
  itemSku: string;
  itemName: string;
  fromLocId: string | null;
  toLocId: string | null;
  fromLocName: string | null;
  toLocName: string | null;
  qty: number;
  note: string | null;
  userEmail: string;
  createdAt: Date;
}

export interface MovementPage {
  entries: MovementView[];
  total: number;
  page: number;
  pageSize: number;
}

/** Everything the wire shape needs, joined in one query. */
const MOVEMENT_INCLUDE = {
  item: { select: { sku: true, name: true } },
  fromLoc: { select: { name: true, zone: true } },
  toLoc: { select: { name: true, zone: true } },
  user: { select: { email: true } },
} satisfies Prisma.MovementInclude;

type MovementRow = Prisma.MovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records one movement and moves the balances it implies, atomically.
   *
   * The debit is a *conditional* `updateMany` (`qty >= requested`) rather than a
   * read-then-write: two concurrent OUTs cannot both pass the check, so stock
   * can never be driven negative. When the condition matches nothing we throw,
   * which rolls the whole transaction back — no partial credit, no Movement row,
   * and the balance the caller can still see is exactly what it was.
   */
  async create(dto: CreateMovementDto, userId: string): Promise<MovementView> {
    const { type, itemId, qty, note } = dto;
    const { fromLocId, toLocId } = this.normaliseShape(dto);

    await this.assertReferencesExist(itemId, fromLocId, toLocId);

    const id = await this.prisma.$transaction(async (tx) => {
      if (fromLocId) {
        const debited = await tx.stockLevel.updateMany({
          where: { itemId, locationId: fromLocId, qty: { gte: qty } },
          data: { qty: { decrement: qty } },
        });
        if (debited.count === 0) {
          throw new BadRequestException('Insufficient stock');
        }
      }

      if (toLocId) {
        await tx.stockLevel.upsert({
          where: { itemId_locationId: { itemId, locationId: toLocId } },
          create: { itemId, locationId: toLocId, qty },
          update: { qty: { increment: qty } },
        });
      }

      const movement = await tx.movement.create({
        data: {
          type,
          itemId,
          fromLocId: fromLocId ?? null,
          toLocId: toLocId ?? null,
          qty,
          note: note?.trim() || null,
          userId,
        },
        select: { id: true },
      });
      return movement.id;
    });

    const created = await this.prisma.movement.findUniqueOrThrow({
      where: { id },
      include: MOVEMENT_INCLUDE,
    });
    return this.toView(created);
  }

  async findAll(query: QueryMovementsDto): Promise<MovementPage> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.movement.count({ where }),
      this.prisma.movement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return {
      entries: rows.map((row) => this.toView(row)),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  /** Recent history for one item — powers the item-detail "movements" tab. */
  async findForItem(itemId: string, take = 25): Promise<MovementView[]> {
    const rows = await this.prisma.movement.findMany({
      where: { itemId },
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((row) => this.toView(row));
  }

  private buildWhere(query: QueryMovementsDto): Prisma.MovementWhereInput {
    const where: Prisma.MovementWhereInput = {};
    if (query.itemId) {
      where.itemId = query.itemId;
    }
    if (query.type) {
      where.type = query.type;
    }

    // `to` is treated as an inclusive end-of-day bound when the caller passed a
    // bare date, so "from 1 Jan to 1 Jan" returns that whole day's entries.
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      createdAt.gte = new Date(query.from);
    }
    if (query.to) {
      createdAt.lte = this.endOfDayIfDateOnly(query.to);
    }
    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }
    return where;
  }

  private endOfDayIfDateOnly(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  /**
   * Rejects the location combinations each type forbids. The DTO already made
   * the required ones present; this closes the other half so, e.g., an `IN`
   * cannot smuggle a `fromLocId` that would silently be ignored.
   */
  private normaliseShape(dto: CreateMovementDto): {
    fromLocId?: string;
    toLocId?: string;
  } {
    const fromLocId = dto.fromLocId?.trim() || undefined;
    const toLocId = dto.toLocId?.trim() || undefined;

    switch (dto.type) {
      case MovementType.IN:
        if (fromLocId) {
          throw new BadRequestException(
            'A receipt (IN) cannot have a source location',
          );
        }
        return { toLocId };
      case MovementType.OUT:
        if (toLocId) {
          throw new BadRequestException(
            'An issue (OUT) cannot have a destination location',
          );
        }
        return { fromLocId };
      case MovementType.TRANSFER:
        if (fromLocId === toLocId) {
          throw new BadRequestException(
            'A transfer needs two different locations',
          );
        }
        return { fromLocId, toLocId };
      default:
        throw new BadRequestException('Unsupported movement type');
    }
  }

  /**
   * Checked up front so a bad id reads as 404 "Item not found" instead of a raw
   * foreign-key violation surfacing from inside the transaction.
   */
  private async assertReferencesExist(
    itemId: string,
    fromLocId?: string,
    toLocId?: string,
  ): Promise<void> {
    const item = await this.prisma.item.count({ where: { id: itemId } });
    if (item === 0) {
      throw new NotFoundException('Item not found');
    }

    const locationIds = [fromLocId, toLocId].filter(
      (id): id is string => typeof id === 'string',
    );
    if (locationIds.length === 0) {
      return;
    }
    const found = await this.prisma.location.count({
      where: { id: { in: locationIds } },
    });
    if (found !== new Set(locationIds).size) {
      throw new NotFoundException('Location not found');
    }
  }

  private toView(row: MovementRow): MovementView {
    return {
      id: row.id,
      type: row.type,
      itemId: row.itemId,
      itemSku: row.item.sku,
      itemName: row.item.name,
      fromLocId: row.fromLocId,
      toLocId: row.toLocId,
      fromLocName: row.fromLoc ? `${row.fromLoc.name} (${row.fromLoc.zone})` : null,
      toLocName: row.toLoc ? `${row.toLoc.name} (${row.toLoc.zone})` : null,
      qty: row.qty,
      note: row.note,
      userEmail: row.user.email,
      createdAt: row.createdAt,
    };
  }
}
