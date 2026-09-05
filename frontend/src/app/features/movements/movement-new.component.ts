import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Item, ItemLocationQty, Location, MovementType } from '../../core/models';
import { urlParam } from '../../core/url-input';

interface TypeOption {
  value: MovementType;
  label: string;
  blurb: string;
  icon: string;
}

@Component({
  selector: 'app-movement-new',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './movement-new.component.html',
  styleUrl: './movement-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementNewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** Wizard state lives entirely in the URL so back/forward and deep links work. */
  readonly step = input('1', { transform: urlParam });
  readonly type = input('', { transform: urlParam });
  readonly itemId = input('', { transform: urlParam });

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly types = signal<TypeOption[]>([
    { value: 'IN', label: 'Stock in', blurb: 'Receive stock into a location.', icon: '↓' },
    { value: 'OUT', label: 'Stock out', blurb: 'Pick or consume stock from a location.', icon: '↑' },
    { value: 'TRANSFER', label: 'Transfer', blurb: 'Move stock between two locations.', icon: '⇄' },
  ]);

  readonly locations = signal<Location[]>([
    { id: 'loc-1', name: 'Receiving Bay', zone: 'Zone A' },
    { id: 'loc-2', name: 'Main Racking', zone: 'Zone B' },
    { id: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C' },
  ]);

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

  /** Per-location balances, used to preview the oversell guard before submitting. */
  readonly stockLevels = signal<(ItemLocationQty & { itemId: string })[]>([
    { itemId: 'it-1', locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 96 },
    { itemId: 'it-1', locationId: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', qty: 32 },
    { itemId: 'it-2', locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 24 },
    { itemId: 'it-3', locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 400 },
    { itemId: 'it-3', locationId: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', qty: 240 },
    { itemId: 'it-4', locationId: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', qty: 18 },
    { itemId: 'it-5', locationId: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', qty: 95 },
    { itemId: 'it-6', locationId: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', qty: 15 },
    { itemId: 'it-7', locationId: 'loc-2', name: 'Main Racking', zone: 'Zone B', qty: 312 },
    { itemId: 'it-8', locationId: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', qty: 6 },
  ]);

  readonly form = this.fb.nonNullable.group({
    fromLocId: [''],
    toLocId: [''],
    qty: [1, [Validators.required, Validators.min(1)]],
    note: [''],
  });

  readonly currentStep = computed(() =>
    this.step() === '2' && this.selectedItem() && this.selectedType() ? 2 : 1,
  );

  readonly selectedItem = computed(
    () => this.items().find((i) => i.id === this.itemId()) ?? null,
  );

  readonly selectedType = computed<MovementType | null>(() => {
    const t = this.type();
    return t === 'IN' || t === 'OUT' || t === 'TRANSFER' ? t : null;
  });

  readonly needsFrom = computed(
    () => this.selectedType() === 'OUT' || this.selectedType() === 'TRANSFER',
  );
  readonly needsTo = computed(
    () => this.selectedType() === 'IN' || this.selectedType() === 'TRANSFER',
  );

  readonly canContinue = computed(() => !!this.selectedItem() && !!this.selectedType());

  /** Balances at each location for the chosen item — shown alongside the form. */
  readonly itemStock = computed(() =>
    this.stockLevels().filter((s) => s.itemId === this.itemId()),
  );

  availableAt(locationId: string): number {
    return this.itemStock().find((s) => s.locationId === locationId)?.qty ?? 0;
  }

  get qty() {
    return this.form.controls.qty;
  }

  pickItem(id: string): void {
    this.patch({ itemId: id || null });
  }

  pickType(type: MovementType): void {
    this.patch({ type });
  }

  goToStep(step: number): void {
    this.serverError.set(null);
    this.success.set(null);
    this.patch({ step: String(step) });
  }

  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  submit(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    this.success.set(null);

    const value = this.form.getRawValue();
    const type = this.selectedType();
    const item = this.selectedItem();
    if (!type || !item) return;

    if (this.needsFrom() && !value.fromLocId) {
      this.serverError.set('Choose the location the stock is leaving.');
      return;
    }
    if (this.needsTo() && !value.toLocId) {
      this.serverError.set('Choose the location the stock is going to.');
      return;
    }
    if (type === 'TRANSFER' && value.fromLocId === value.toLocId) {
      this.serverError.set('A transfer must be between two different locations.');
      return;
    }
    if (this.form.invalid || Number(value.qty) < 1) {
      this.form.markAllAsTouched();
      return;
    }

    // Mirrors the server's conditional decrement: the whole transaction is
    // rejected rather than allowing the balance to go negative. The form keeps
    // its values so the entry can be corrected and resubmitted.
    if (this.needsFrom()) {
      const available = this.availableAt(value.fromLocId);
      if (Number(value.qty) > available) {
        this.serverError.set(
          `Insufficient stock — only ${available} ${item.unit} available at that location. Nothing was changed.`,
        );
        return;
      }
    }

    this.submitting.set(true);
    const moved = Number(value.qty);
    const delta = type === 'IN' ? moved : type === 'OUT' ? -moved : 0;
    this.items.update((list) =>
      list.map((i) =>
        i.id === item.id
          ? {
              ...i,
              qtyOnHand: i.qtyOnHand + delta,
              isLow: i.qtyOnHand + delta <= i.reorderAt,
            }
          : i,
      ),
    );
    this.submitting.set(false);
    this.success.set(
      `Recorded ${type} of ${moved} ${item.unit} for ${item.sku}. On hand is now ${
        (this.selectedItem()?.qtyOnHand ?? 0)
      } ${item.unit}.`,
    );
    this.form.patchValue({ qty: 1, note: '' });
    this.submitted.set(false);
  }

  badgeClass(type: MovementType): string {
    return type === 'IN'
      ? 'badge badge--in'
      : type === 'OUT'
        ? 'badge badge--out'
        : 'badge badge--transfer';
  }
}
