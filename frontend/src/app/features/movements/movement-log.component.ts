import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LayoutService } from '../../core/layout.service';
import { Item, Movement, MovementType } from '../../core/models';
import { urlParam } from '../../core/url-input';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-movement-log',
  imports: [RouterLink, DatePipe],
  templateUrl: './movement-log.component.html',
  styleUrl: './movement-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementLogComponent {
  private readonly router = inject(Router);
  readonly layout = inject(LayoutService);

  /** Every filter and the page number are held in the URL. */
  readonly itemId = input('', { transform: urlParam });
  readonly type = input('', { transform: urlParam });
  readonly from = input('', { transform: urlParam });
  readonly to = input('', { transform: urlParam });
  readonly page = input('1', { transform: urlParam });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pageSize = PAGE_SIZE;

  readonly types = signal<MovementType[]>(['IN', 'OUT', 'TRANSFER']);

  readonly items = signal<Item[]>([
    { id: 'it-1', sku: 'SKU-001', name: '20mm Hex Bolt, Zinc', unit: 'box', reorderAt: 40, qtyOnHand: 128, isLow: false },
    { id: 'it-2', sku: 'SKU-002', name: 'M8 Lock Nut', unit: 'box', reorderAt: 30, qtyOnHand: 24, isLow: true },
    { id: 'it-3', sku: 'SKU-003', name: 'Corrugated Carton 400x300', unit: 'pcs', reorderAt: 100, qtyOnHand: 640, isLow: false },
    { id: 'it-4', sku: 'SKU-004', name: 'Pallet Wrap 500mm', unit: 'roll', reorderAt: 25, qtyOnHand: 18, isLow: true },
    { id: 'it-5', sku: 'SKU-005', name: 'Thermal Label 100x150', unit: 'roll', reorderAt: 20, qtyOnHand: 95, isLow: false },
    { id: 'it-6', sku: 'SKU-006', name: 'Nitrile Glove, Large', unit: 'box', reorderAt: 15, qtyOnHand: 15, isLow: true },
    { id: 'it-7', sku: 'SKU-007', name: 'Cable Tie 300mm', unit: 'pack', reorderAt: 50, qtyOnHand: 312, isLow: false },
    { id: 'it-8', sku: 'SKU-008', name: 'Shelf Bracket 250mm', unit: 'pcs', reorderAt: 40, qtyOnHand: 6, isLow: true },
  ]);

  readonly movements = signal<Movement[]>([
    { id: 'mv-101', type: 'TRANSFER', itemId: 'it-1', itemSku: 'SKU-001', itemName: '20mm Hex Bolt, Zinc', fromLocName: 'Receiving Bay', toLocName: 'Main Racking', qty: 48, note: 'Put-away after goods-in check', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-04T14:22:00Z' },
    { id: 'mv-100', type: 'OUT', itemId: 'it-3', itemSku: 'SKU-003', itemName: 'Corrugated Carton 400x300', fromLocName: 'Dispatch Lane', toLocName: null, qty: 60, note: 'Outbound wave 12', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-04T11:05:00Z' },
    { id: 'mv-099', type: 'IN', itemId: 'it-7', itemSku: 'SKU-007', itemName: 'Cable Tie 300mm', fromLocName: null, toLocName: 'Main Racking', qty: 120, note: 'PO-4422 delivery', userEmail: 'manager@stockroom.app', createdAt: '2026-09-04T08:50:00Z' },
    { id: 'mv-098', type: 'TRANSFER', itemId: 'it-3', itemSku: 'SKU-003', itemName: 'Corrugated Carton 400x300', fromLocName: 'Main Racking', toLocName: 'Dispatch Lane', qty: 240, note: 'Pre-stage for dispatch', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-03T15:40:00Z' },
    { id: 'mv-097', type: 'OUT', itemId: 'it-1', itemSku: 'SKU-001', itemName: '20mm Hex Bolt, Zinc', fromLocName: 'Main Racking', toLocName: null, qty: 12, note: 'Works order WO-2291', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-03T09:05:00Z' },
    { id: 'mv-096', type: 'OUT', itemId: 'it-6', itemSku: 'SKU-006', itemName: 'Nitrile Glove, Large', fromLocName: 'Receiving Bay', toLocName: null, qty: 5, note: 'PPE issue, shift A', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-02T18:20:00Z' },
    { id: 'mv-093', type: 'OUT', itemId: 'it-2', itemSku: 'SKU-002', itemName: 'M8 Lock Nut', fromLocName: 'Main Racking', toLocName: null, qty: 6, note: 'Line replenishment', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-02T16:12:00Z' },
    { id: 'mv-092', type: 'IN', itemId: 'it-5', itemSku: 'SKU-005', itemName: 'Thermal Label 100x150', fromLocName: null, toLocName: 'Dispatch Lane', qty: 95, note: 'Opening balance', userEmail: 'manager@stockroom.app', createdAt: '2026-09-01T08:42:00Z' },
    { id: 'mv-091', type: 'IN', itemId: 'it-4', itemSku: 'SKU-004', itemName: 'Pallet Wrap 500mm', fromLocName: null, toLocName: 'Dispatch Lane', qty: 18, note: 'Opening balance', userEmail: 'manager@stockroom.app', createdAt: '2026-09-01T08:41:00Z' },
    { id: 'mv-088', type: 'IN', itemId: 'it-1', itemSku: 'SKU-001', itemName: '20mm Hex Bolt, Zinc', fromLocName: null, toLocName: 'Receiving Bay', qty: 80, note: 'PO-4417 delivery', userEmail: 'manager@stockroom.app', createdAt: '2026-09-01T08:40:00Z' },
    { id: 'mv-085', type: 'OUT', itemId: 'it-8', itemSku: 'SKU-008', itemName: 'Shelf Bracket 250mm', fromLocName: 'Receiving Bay', toLocName: null, qty: 34, note: 'Rack build, aisle 3', userEmail: 'clerk@stockroom.app', createdAt: '2026-08-31T11:30:00Z' },
    { id: 'mv-084', type: 'IN', itemId: 'it-8', itemSku: 'SKU-008', itemName: 'Shelf Bracket 250mm', fromLocName: null, toLocName: 'Receiving Bay', qty: 40, note: 'Opening balance', userEmail: 'manager@stockroom.app', createdAt: '2026-08-30T09:00:00Z' },
  ]);

  readonly currentPage = computed(() => {
    const n = Number(this.page());
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  });

  readonly matching = computed(() => {
    const itemId = this.itemId();
    const type = this.type();
    const from = this.from() ? Date.parse(this.from()) : null;
    const to = this.to() ? Date.parse(`${this.to()}T23:59:59Z`) : null;

    return this.movements().filter((m) => {
      if (itemId && m.itemId !== itemId) return false;
      if (type && m.type !== type) return false;
      const at = Date.parse(m.createdAt);
      if (from !== null && at < from) return false;
      if (to !== null && at > to) return false;
      return true;
    });
  });

  readonly total = computed(() => this.matching().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly entries = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.matching().slice(start, start + PAGE_SIZE);
  });

  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.currentPage() - 1) * PAGE_SIZE + 1,
  );
  readonly rangeEnd = computed(() =>
    Math.min(this.currentPage() * PAGE_SIZE, this.total()),
  );

  readonly hasFilters = computed(
    () => !!(this.itemId() || this.type() || this.from() || this.to()),
  );

  setFilter(key: 'itemId' | 'type' | 'from' | 'to', value: string): void {
    this.patch({ [key]: value || null, page: null });
  }

  goToPage(page: number): void {
    this.patch({ page: page <= 1 ? null : String(page) });
  }

  clearFilters(): void {
    this.patch({ itemId: null, type: null, from: null, to: null, page: null });
  }

  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  badgeClass(type: MovementType): string {
    return type === 'IN'
      ? 'badge badge--in'
      : type === 'OUT'
        ? 'badge badge--out'
        : 'badge badge--transfer';
  }
}
