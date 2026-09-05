import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ItemDetail, Movement } from '../../core/models';
import { urlParam } from '../../core/url-input';

type Tab = 'locations' | 'movements';

@Component({
  selector: 'app-item-detail',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** `:id` route param and `?tab=` query param, both bound from the URL. */
  readonly id = input('', { transform: urlParam });
  readonly tab = input('locations', { transform: urlParam });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly items = signal<ItemDetail[]>([
    {
      id: 'it-1', sku: 'SKU-001', name: '20mm Hex Bolt, Zinc', description: 'Grade 8.8 zinc-plated hex bolt, 20mm shank.', unit: 'box', reorderAt: 40, qtyOnHand: 128, isLow: false,
      locations: [
        { locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 96 },
        { locationId: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', qty: 32 },
      ],
    },
    {
      id: 'it-2', sku: 'SKU-002', name: 'M8 Lock Nut', description: 'Nylon-insert locking nut, M8.', unit: 'box', reorderAt: 30, qtyOnHand: 24, isLow: true,
      locations: [{ locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 24 }],
    },
    {
      id: 'it-3', sku: 'SKU-003', name: 'Corrugated Carton 400x300', description: 'Double-wall shipping carton.', unit: 'pcs', reorderAt: 100, qtyOnHand: 640, isLow: false,
      locations: [
        { locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 400 },
        { locationId: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', qty: 240 },
      ],
    },
    {
      id: 'it-4', sku: 'SKU-004', name: 'Pallet Wrap 500mm', description: 'Clear stretch film, 23 micron.', unit: 'roll', reorderAt: 25, qtyOnHand: 18, isLow: true,
      locations: [{ locationId: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', qty: 18 }],
    },
    {
      id: 'it-5', sku: 'SKU-005', name: 'Thermal Label 100x150', description: 'Direct thermal shipping label.', unit: 'roll', reorderAt: 20, qtyOnHand: 95, isLow: false,
      locations: [{ locationId: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', qty: 95 }],
    },
    {
      id: 'it-6', sku: 'SKU-006', name: 'Nitrile Glove, Large', description: 'Powder-free, blue, 100 per box.', unit: 'box', reorderAt: 15, qtyOnHand: 15, isLow: true,
      locations: [{ locationId: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', qty: 15 }],
    },
    {
      id: 'it-7', sku: 'SKU-007', name: 'Cable Tie 300mm', description: 'UV-stable black nylon tie.', unit: 'pack', reorderAt: 50, qtyOnHand: 312, isLow: false,
      locations: [{ locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 312 }],
    },
    {
      id: 'it-8', sku: 'SKU-008', name: 'Shelf Bracket 250mm', description: 'Powder-coated steel bracket.', unit: 'pcs', reorderAt: 40, qtyOnHand: 6, isLow: true,
      locations: [{ locationId: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', qty: 6 }],
    },
  ]);

  readonly movements = signal<Movement[]>([
    { id: 'mv-101', type: 'TRANSFER', itemId: 'it-1', itemSku: 'SKU-001', itemName: '20mm Hex Bolt, Zinc', fromLocName: 'Receiving Bay', toLocName: 'Main Racking', qty: 48, note: 'Put-away after goods-in check', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-04T14:22:00Z' },
    { id: 'mv-097', type: 'OUT', itemId: 'it-1', itemSku: 'SKU-001', itemName: '20mm Hex Bolt, Zinc', fromLocName: 'Main Racking', toLocName: null, qty: 12, note: 'Works order WO-2291', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-03T09:05:00Z' },
    { id: 'mv-088', type: 'IN', itemId: 'it-1', itemSku: 'SKU-001', itemName: '20mm Hex Bolt, Zinc', fromLocName: null, toLocName: 'Receiving Bay', qty: 80, note: 'PO-4417 delivery', userEmail: 'manager@stockroom.app', createdAt: '2026-09-01T08:40:00Z' },
    { id: 'mv-093', type: 'OUT', itemId: 'it-2', itemSku: 'SKU-002', itemName: 'M8 Lock Nut', fromLocName: 'Main Racking', toLocName: null, qty: 6, note: 'Line replenishment', userEmail: 'clerk@stockroom.app', createdAt: '2026-09-02T16:12:00Z' },
    { id: 'mv-091', type: 'IN', itemId: 'it-4', itemSku: 'SKU-004', itemName: 'Pallet Wrap 500mm', fromLocName: null, toLocName: 'Dispatch Lane', qty: 18, note: 'Opening balance', userEmail: 'manager@stockroom.app', createdAt: '2026-09-01T08:41:00Z' },
    { id: 'mv-085', type: 'OUT', itemId: 'it-8', itemSku: 'SKU-008', itemName: 'Shelf Bracket 250mm', fromLocName: 'Receiving Bay', toLocName: null, qty: 34, note: 'Rack build, aisle 3', userEmail: 'clerk@stockroom.app', createdAt: '2026-08-31T11:30:00Z' },
  ]);

  readonly item = computed(
    () => this.items().find((i) => i.id === this.id()) ?? null,
  );

  readonly activeTab = computed<Tab>(() =>
    this.tab() === 'movements' ? 'movements' : 'locations',
  );

  readonly locationTotal = computed(() =>
    (this.item()?.locations ?? []).reduce((sum, l) => sum + l.qty, 0),
  );

  readonly itemMovements = computed(() =>
    this.movements().filter((m) => m.itemId === this.id()),
  );

  readonly headroom = computed(() => {
    const it = this.item();
    return it ? it.qtyOnHand - it.reorderAt : 0;
  });

  selectTab(tab: Tab): void {
    void this.router.navigate([], {
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  badgeClass(type: string): string {
    return type === 'IN'
      ? 'badge badge--in'
      : type === 'OUT'
        ? 'badge badge--out'
        : 'badge badge--transfer';
  }
}
