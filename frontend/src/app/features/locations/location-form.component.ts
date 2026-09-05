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
import { Location } from '../../core/models';
import { urlParam } from '../../core/url-input';

@Component({
  selector: 'app-location-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './location-form.component.html',
  styleUrl: './location-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly id = input('', { transform: urlParam });

  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly nameError = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly confirmingDelete = signal(false);

  readonly locations = signal<Location[]>([
    { id: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', itemCount: 3, totalQty: 53 },
    { id: 'loc-2', name: 'Main Racking', zone: 'Zone B', itemCount: 4, totalQty: 832 },
    { id: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', itemCount: 3, totalQty: 353 },
  ]);

  readonly editing = computed(() => !!this.id());
  readonly existing = computed(
    () => this.locations().find((l) => l.id === this.id()) ?? null,
  );
  readonly inUse = computed(() => (this.existing()?.totalQty ?? 0) > 0);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    zone: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const loc = this.existing();
      if (!loc) return;
      this.form.patchValue({ name: loc.name, zone: loc.zone });
    });
  }

  get name() {
    return this.form.controls.name;
  }
  get zone() {
    return this.form.controls.zone;
  }

  submit(): void {
    this.submitted.set(true);
    this.nameError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const clash = this.locations().some(
      (l) =>
        l.id !== this.id() &&
        l.name.toLowerCase() === value.name.trim().toLowerCase() &&
        l.zone.toLowerCase() === value.zone.trim().toLowerCase(),
    );
    if (clash) {
      this.nameError.set('A location with that name already exists in this zone.');
      return;
    }

    this.saving.set(true);
    const loc: Location = {
      id: this.id() || `loc-${this.locations().length + 1}`,
      name: value.name.trim(),
      zone: value.zone.trim(),
      itemCount: this.existing()?.itemCount ?? 0,
      totalQty: this.existing()?.totalQty ?? 0,
    };
    this.locations.update((list) =>
      this.editing() ? list.map((l) => (l.id === loc.id ? loc : l)) : [...list, loc],
    );
    this.saving.set(false);
    void this.router.navigate(['/locations']);
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
        'This location still holds stock or is referenced by movements, so it cannot be deleted. Transfer the stock elsewhere first.',
      );
      this.confirmingDelete.set(false);
      return;
    }
    this.locations.update((list) => list.filter((l) => l.id !== this.id()));
    this.confirmingDelete.set(false);
    void this.router.navigate(['/locations']);
  }
}
