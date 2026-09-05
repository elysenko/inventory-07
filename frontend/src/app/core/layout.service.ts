import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';

/**
 * Single source of truth for responsive layout switching. Components read
 * `isHandset()` to swap a desktop table for a stacked card list, or a side
 * panel for a bottom sheet — a behaviour switch, not just a CSS one.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly breakpoints = inject(BreakpointObserver);

  readonly isHandset = toSignal(
    this.breakpoints
      .observe([Breakpoints.Handset, '(max-width: 768px)'])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
}
