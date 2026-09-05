import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Item } from '../../core/models';
import { urlParam } from '../../core/url-input';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** `:id` is absent on `/items/new` and present on `/items/:id/edit`. */
  readonly id = input('', { transform: urlParam });

  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly formError = signal<string | null>(null);
  readonly skuError = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly confirmingDelete = signal(false);

  readonly units = signal<string[]>(['box', 'pcs', 'roll', 'pack', 'pallet', 'kg']);

  readonly items = signal<Item[]>([
    { id: 'it-1', sku: 'SKU-001', name: '20mm Hex Bolt, Zinc', description: 'Grade 8.8 zinc-plated hex bolt, 20mm shank.', unit: 'box', reorderAt: 40, qtyOnHand: 128, isLow: false },
    { id: 'it-2', sku: 'SKU-002', name: 'M8 Lock Nut', description: 'Nylon-insert locking nut, M8.', unit: 'box', reorderAt: 30, qtyOnHand: 24, isLow: true },
    { id: 'it-3', sku: 'SKU-003', name: 'Corrugated Carton 400x300', description: 'Double-wall shipping carton.', unit: 'pcs', reorderAt: 100, qtyOnHand: 640, isLow: false },
    { id: 'it-4', sku: 'SKU-004', name: 'Pallet Wrap 500mm', description: 'Clear stretch film, 23 micron.', unit: 'roll', reorderAt: 25, qtyOnHand: 18, isLow: true },
    { id: 'it-5', sku: 'SKU-005', name: 'Thermal Label 100x150', description: 'Direct thermal shipping label.', unit: 'roll', reorderAt: 20, qtyOnHand: 95, isLow: false },
    { id: 'it-6', sku: 'SKU-006', name: 'Nitrile Glove, Large', description: 'Powder-free, blue, 100 per box.', unit: 'box', reorderAt: 15, qtyOnHand: 15, isLow: true },
    { id: 'it-7', sku: 'SKU-007', name: 'Cable Tie 300mm', description: 'UV-stable black nylon tie.', unit: 'pack', reorderAt: 50, qtyOnHand: 312, isLow: false },
    { id: 'it-8', sku: 'SKU-008', name: 'Shelf Bracket 250mm', description: 'Powder-coated steel bracket.', unit: 'pcs', reorderAt: 40, qtyOnHand: 6, isLow: true },
  ]);

  readonly editing = computed(() => !!this.id());
  readonly existing = computed(
    () => this.items().find((i) => i.id === this.id()) ?? null,
  );
  /** Deleting is blocked when stock or movements still reference the item. */
  readonly inUse = computed(() => (this.existing()?.qtyOnHand ?? 0) > 0);

  readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{3,}$/)]],
    name: ['', [Validators.required]],
    description: [''],
    unit: ['box', [Validators.required]],
    reorderAt: [10, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      const item = this.existing();
      if (!item) return;
      this.form.patchValue({
        sku: item.sku,
        name: item.name,
        description: item.description ?? '',
        unit: item.unit,
        reorderAt: item.reorderAt,
      });
    });
  }

  get sku() {
    return this.form.controls.sku;
  }
  get name() {
    return this.form.controls.name;
  }
  get reorderAt() {
    return this.form.controls.reorderAt;
  }

  submit(): void {
    this.submitted.set(true);
    this.skuError.set(null);
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const clash = this.items().some(
      (i) => i.sku.toLowerCase() === value.sku.trim().toLowerCase() && i.id !== this.id(),
    );
    if (clash) {
      // Mirrors the API's Prisma P2002 mapping: 400 { message: 'SKU already exists' }
      this.skuError.set('SKU already exists');
      return;
    }

    this.saving.set(true);
    const item: Item = {
      id: this.id() || `it-${this.items().length + 1}`,
      sku: value.sku.trim().toUpperCase(),
      name: value.name.trim(),
      description: value.description.trim() || null,
      unit: value.unit,
      reorderAt: Number(value.reorderAt),
      qtyOnHand: this.existing()?.qtyOnHand ?? 0,
      isLow: (this.existing()?.qtyOnHand ?? 0) <= Number(value.reorderAt),
    };

    this.items.update((list) =>
      this.editing()
        ? list.map((i) => (i.id === item.id ? item : i))
        : [...list, item],
    );
    this.saving.set(false);
    void this.router.navigate(['/items', item.id]);
  }

  askDelete(): void {
    this.deleteError.set(null);
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    if (this.inUse()) {
      this.deleteError.set(
        'This item still has stock or recorded movements, so it cannot be deleted. Move the remaining stock out first.',
      );
      this.confirmingDelete.set(false);
      return;
    }
    this.items.update((list) => list.filter((i) => i.id !== this.id()));
    this.confirmingDelete.set(false);
    void this.router.navigate(['/items']);
  }
}
