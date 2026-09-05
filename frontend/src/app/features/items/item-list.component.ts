import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LayoutService } from '../../core/layout.service';
import { Item } from '../../core/models';
import { urlParam } from '../../core/url-input';

@Component({
  selector: 'app-item-list',
  imports: [RouterLink],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemListComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly layout = inject(LayoutService);

  /** Bound from `?q=` and `?lowStock=` — the filter state lives in the URL. */
  readonly q = input('', { transform: urlParam });
  readonly lowStock = input('', { transform: urlParam });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly items = signal<Item[]>([
    { id: 'it-1', sku: 'SKU-001', name: '20mm Hex Bolt, Zinc', description: 'Grade 8.8 zinc-plated hex bolt.', unit: 'box', reorderAt: 40, qtyOnHand: 128, isLow: false },
    { id: 'it-2', sku: 'SKU-002', name: 'M8 Lock Nut', description: 'Nylon-insert locking nut, M8.', unit: 'box', reorderAt: 30, qtyOnHand: 24, isLow: true },
    { id: 'it-3', sku: 'SKU-003', name: 'Corrugated Carton 400x300', description: 'Double-wall shipping carton.', unit: 'pcs', reorderAt: 100, qtyOnHand: 640, isLow: false },
    { id: 'it-4', sku: 'SKU-004', name: 'Pallet Wrap 500mm', description: 'Clear stretch film, 23 micron.', unit: 'roll', reorderAt: 25, qtyOnHand: 18, isLow: true },
    { id: 'it-5', sku: 'SKU-005', name: 'Thermal Label 100x150', description: 'Direct thermal shipping label.', unit: 'roll', reorderAt: 20, qtyOnHand: 95, isLow: false },
    { id: 'it-6', sku: 'SKU-006', name: 'Nitrile Glove, Large', description: 'Powder-free, blue, 100 per box.', unit: 'box', reorderAt: 15, qtyOnHand: 15, isLow: true },
    { id: 'it-7', sku: 'SKU-007', name: 'Cable Tie 300mm', description: 'UV-stable black nylon tie.', unit: 'pack', reorderAt: 50, qtyOnHand: 312, isLow: false },
    { id: 'it-8', sku: 'SKU-008', name: 'Shelf Bracket 250mm', description: 'Powder-coated steel bracket.', unit: 'pcs', reorderAt: 40, qtyOnHand: 6, isLow: true },
  ]);

  readonly lowOnly = computed(() => this.lowStock() === 'true');

  readonly visible = computed(() => {
    const term = this.q().trim().toLowerCase();
    return this.items().filter((item) => {
      if (this.lowOnly() && !item.isLow) return false;
      if (!term) return true;
      return (
        item.sku.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term)
      );
    });
  });

  readonly lowCount = computed(() => this.items().filter((i) => i.isLow).length);
  readonly totalUnits = computed(() =>
    this.items().reduce((sum, i) => sum + i.qtyOnHand, 0),
  );
  readonly filtered = computed(() => !!this.q().trim() || this.lowOnly());

  onSearch(value: string): void {
    this.patchQuery({ q: value.trim() || null });
  }

  toggleLowStock(): void {
    this.patchQuery({ lowStock: this.lowOnly() ? null : 'true' });
  }

  clearFilters(): void {
    this.patchQuery({ q: null, lowStock: null });
  }

  private patchQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }
}
