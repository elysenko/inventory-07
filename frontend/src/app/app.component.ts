import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './core/auth.service';
import { Role } from './core/models';

/**
 * Build-time constant substituted by the Angular builder (`define` in
 * angular.json): `false` for production, `true` for the `mockup` preview build.
 * Declared locally as well as in `src/preview.d.ts` so this file type-checks
 * under any tsconfig, including a check that does not pull the ambient file in.
 */
declare const COLOSSUS_PREVIEW: boolean;


interface NavItem {
  label: string;
  short: string;
  path: string;
  icon: string;
  need: 'any' | 'manager' | 'admin';
}

const NAV: NavItem[] = [
  { label: 'Items', short: 'Items', path: '/items', icon: '▦', need: 'any' },
  { label: 'Locations', short: 'Zones', path: '/locations', icon: '⌗', need: 'any' },
  { label: 'Record movement', short: 'Record', path: '/movements/new', icon: '⇄', need: 'any' },
  { label: 'Audit log', short: 'Log', path: '/movements', icon: '☰', need: 'manager' },
  { label: 'Low stock', short: 'Low', path: '/reports/low-stock', icon: '⚠', need: 'manager' },
  { label: 'Admin settings', short: 'Admin', path: '/admin/settings', icon: '⚙', need: 'admin' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breakpoints = inject(BreakpointObserver);
  readonly auth = inject(AuthService);

  readonly previewMode = COLOSSUS_PREVIEW;
  readonly drawerOpen = signal(false);
  readonly menuOpen = signal(false);

  /** Layout switches on the observed breakpoint, not on CSS alone. */
  readonly isHandset = toSignal(
    this.breakpoints
      .observe([Breakpoints.Handset, '(max-width: 768px)'])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  /** Auth screens render standalone — no header, sidebar or drawer. */
  readonly showChrome = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let r = this.route.firstChild;
        while (r?.firstChild) r = r.firstChild;
        return r?.snapshot.data['chrome'] !== false;
      }),
    ),
    { initialValue: true },
  );

  readonly navItems = computed(() =>
    NAV.filter((n) =>
      n.need === 'any'
        ? true
        : n.need === 'manager'
          ? this.auth.isManager()
          : this.auth.isAdmin(),
    ),
  );

  readonly roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' ? 'Admin' : role === 'MANAGER' ? 'Manager' : 'Clerk';
  });

  readonly initials = computed(() => {
    const u = this.auth.user();
    if (!u) return '?';
    const source = (u.name || u.email).trim();
    const parts = source.split(/[\s.@]+/).filter(Boolean);
    return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
  });

  readonly previewRoles: { role: Role; label: string }[] = [
    { role: 'USER', label: 'Clerk' },
    { role: 'MANAGER', label: 'Manager' },
    { role: 'ADMIN', label: 'Admin' },
  ];

  toggleDrawer(): void {
    this.drawerOpen.update((v) => !v);
    this.menuOpen.set(false);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  switchRole(role: Role): void {
    this.auth.previewSetRole(role);
    this.menuOpen.set(false);
    this.drawerOpen.set(false);
    void this.router.navigateByUrl('/items');
  }

  logout(): void {
    this.menuOpen.set(false);
    this.drawerOpen.set(false);
    this.auth.logout();
  }
}
