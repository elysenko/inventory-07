import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LayoutService } from '../../core/layout.service';
import { Location } from '../../core/models';

@Component({
  selector: 'app-location-list',
  imports: [RouterLink],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationListComponent {
  readonly auth = inject(AuthService);
  readonly layout = inject(LayoutService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly locations = signal<Location[]>([
    { id: 'loc-1', name: 'Receiving Bay', zone: 'Zone A', itemCount: 3, totalQty: 53 },
    { id: 'loc-2', name: 'Main Racking', zone: 'Zone B', itemCount: 4, totalQty: 832 },
    { id: 'loc-3', name: 'Dispatch Lane', zone: 'Zone C', itemCount: 3, totalQty: 353 },
  ]);

  readonly totalUnits = computed(() =>
    this.locations().reduce((sum, l) => sum + (l.totalQty ?? 0), 0),
  );
}
