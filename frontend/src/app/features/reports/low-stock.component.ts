import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LayoutService } from '../../core/layout.service';
import { LowStockRow } from '../../core/models';

@Component({
  selector: 'app-low-stock',
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent {
  readonly layout = inject(LayoutService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Sorted by deficit descending, exactly as the report endpoint returns it. */
  readonly rows = signal<LowStockRow[]>([
    { itemId: 'it-8', sku: 'SKU-008', name: 'Shelf Bracket 250mm', unit: 'pcs', onHand: 6, reorderAt: 40, deficit: 34 },
    { itemId: 'it-4', sku: 'SKU-004', name: 'Pallet Wrap 500mm', unit: 'roll', onHand: 18, reorderAt: 25, deficit: 7 },
    { itemId: 'it-2', sku: 'SKU-002', name: 'M8 Lock Nut', unit: 'box', onHand: 24, reorderAt: 30, deficit: 6 },
    { itemId: 'it-6', sku: 'SKU-006', name: 'Nitrile Glove, Large', unit: 'box', onHand: 15, reorderAt: 15, deficit: 0 },
  ]);

  readonly totalDeficit = computed(() =>
    this.rows().reduce((sum, r) => sum + r.deficit, 0),
  );

  readonly critical = computed(() => this.rows().filter((r) => r.onHand === 0).length);
}
