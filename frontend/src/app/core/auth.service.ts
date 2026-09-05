import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Role, User } from './models';
import { clearStored, readStored, writeStored } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;

/** Roles that satisfy a manager-level check (ADMIN is a superset of MANAGER). */
const MANAGER_ROLES: Role[] = ['MANAGER', 'ADMIN'];

/** Identities used to seed the preview session. Not credentials — no passwords. */
const PREVIEW_IDENTITIES: Record<Role, User> = COLOSSUS_PREVIEW ? {
  ADMIN: { id: 'u-admin', email: 'admin@stockroom.app', name: 'Dana Whitfield', role: 'ADMIN' },
  MANAGER: { id: 'u-manager', email: 'manager@stockroom.app', name: 'Priya Raman', role: 'MANAGER' },
  USER: { id: 'u-clerk', email: 'clerk@stockroom.app', name: 'Tom Alvarez', role: 'USER' },
} : ({} as Record<Role, User>);

function isUser(value: unknown): value is User {
  const u = value as User | null;
  return (
    !!u &&
    typeof u === 'object' &&
    typeof u.id === 'string' &&
    typeof u.email === 'string' &&
    (u.role === 'USER' || u.role === 'MANAGER' || u.role === 'ADMIN')
  );
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isManager = computed(() => {
    const role = this.user()?.role;
    return !!role && MANAGER_ROLES.includes(role);
  });
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  /** Landing route once signed in. */
  readonly homeRoute = '/items';

  constructor() {
    this.restore();
  }

  /**
   * Rehydrate from storage. Anything stored is untrusted: on a parse failure or
   * an unrecognised shape we clear the keys and continue to a usable screen
   * rather than throwing and blanking the page.
   */
  private restore(): void {
    try {
      const raw = readStored(USER_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isUser(parsed)) {
        this.user.set(parsed);
        return;
      }
      clearStored(USER_KEY, TOKEN_KEY);
    } catch {
      clearStored(USER_KEY, TOKEN_KEY);
    }
  }

  private persist(user: User, token: string): void {
    this.user.set(user);
    writeStored(USER_KEY, JSON.stringify(user));
    writeStored(TOKEN_KEY, token);
  }

  /**
   * Sign in.
   *
   * In the static preview there is no API server, so a network round-trip would
   * strand the reviewer on this screen. The preview branch resolves the
   * credentials locally and synchronously; the production branch is the real
   * HTTP call. `COLOSSUS_PREVIEW` is a build-time literal, so only one of these
   * two branches survives into any given bundle.
   */
  async login(email: string, password: string, returnUrl?: string): Promise<void> {
    this.error.set(null);

    if (COLOSSUS_PREVIEW) {
      const cleanEmail = email.trim();
      if (!cleanEmail || !EMAIL_RE.test(cleanEmail) || !password.trim()) {
        this.error.set('Enter a valid email address and your password.');
        return;
      }
      const role = this.roleFromEmail(cleanEmail);
      this.persist(
        { ...PREVIEW_IDENTITIES[role], email: cleanEmail },
        'preview-session',
      );
      await this.router.navigateByUrl(returnUrl || this.homeRoute);
      return;
    }

    this.busy.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<{ accessToken: string; user: User }>('/api/auth/login', {
          email,
          password,
        }),
      );
      this.persist(res.user, res.accessToken);
      await this.router.navigateByUrl(returnUrl || this.homeRoute);
    } catch {
      this.error.set('Those credentials were not recognised.');
    } finally {
      this.busy.set(false);
    }
  }

  async signup(email: string, password: string, name: string): Promise<void> {
    this.error.set(null);

    if (COLOSSUS_PREVIEW) {
      const cleanEmail = email.trim();
      if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
        this.error.set('Enter a valid email address.');
        return;
      }
      if (password.length < 8) {
        this.error.set('Choose a password of at least 8 characters.');
        return;
      }
      this.persist(
        { id: 'u-new', email: cleanEmail, name: name.trim() || null, role: 'USER' },
        'preview-session',
      );
      await this.router.navigateByUrl(this.homeRoute);
      return;
    }

    this.busy.set(true);
    try {
      await firstValueFrom(
        this.http.post('/api/auth/signup', { email, password, name }),
      );
      await this.login(email, password);
    } catch {
      this.error.set('That email address is already registered.');
    } finally {
      this.busy.set(false);
    }
  }

  logout(): void {
    this.user.set(null);
    clearStored(USER_KEY, TOKEN_KEY);
    void this.router.navigateByUrl('/login');
  }

  /**
   * Preview-only: seed a signed-in session without any credentials.
   *
   * The positive `if (COLOSSUS_PREVIEW)` form matters — with the constant
   * folded to `false` the whole block is dropped, taking the demo identities
   * with it, so nothing preview-specific reaches the production bundle.
   */
  previewSignIn(role: Role = 'ADMIN', navigate = true): void {
    if (COLOSSUS_PREVIEW) {
      this.persist(PREVIEW_IDENTITIES[role], 'preview-session');
      if (navigate) void this.router.navigateByUrl(this.homeRoute);
    }
  }

  /** Preview-only: swap the acting role so every permission tier is reviewable. */
  previewSetRole(role: Role): void {
    if (COLOSSUS_PREVIEW) {
      this.persist(PREVIEW_IDENTITIES[role], 'preview-session');
    }
  }

  /**
   * Preview-only convenience: pick a demo persona from the local part of the
   * address so a reviewer can type `clerk@…` and see the clerk-restricted nav.
   */
  private roleFromEmail(email: string): Role {
    const local = email.split('@')[0].toLowerCase();
    if (local.includes('clerk') || local.includes('user')) return 'USER';
    if (local.includes('manager')) return 'MANAGER';
    return 'ADMIN';
  }
}
