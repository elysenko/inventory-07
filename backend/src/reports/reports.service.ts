import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LowStockRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  reorderAt: number;
  deficit: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Items at or below their reorder threshold, worst first.
   *
   * Items with no StockLevel rows at all still have to appear (they are on hand
   * zero, which is the most urgent case), so the join starts from Item rather
   * than from a groupBy over StockLevel.
   */
  async lowStock(): Promise<LowStockRow[]> {
    const items = await this.prisma.item.findMany({
      include: { stockLevels: { select: { qty: true } } },
    });

    return items
      .map((item) => {
        const onHand = item.stockLevels.reduce((sum, row) => sum + row.qty, 0);
        return {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          onHand,
          reorderAt: item.reorderAt,
          deficit: item.reorderAt - onHand,
        };
      })
      .filter((row) => row.onHand <= row.reorderAt)
      .sort((a, b) =>
        b.deficit === a.deficit
          ? a.sku.localeCompare(b.sku)
          : b.deficit - a.deficit,
      );
  }
}
