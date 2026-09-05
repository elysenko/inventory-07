import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Build-time constant substituted by the Angular builder (`define` in
 * angular.json): `false` for production, `true` for the `mockup` preview build.
 * Declared locally as well as in `src/preview.d.ts` so this file type-checks
 * under any tsconfig, including a check that does not pull the ambient file in.
 */
declare const COLOSSUS_PREVIEW: boolean;


/**
 * Requires a signed-in user. Redirects at most once, and never from `/login`
 * (that route is unguarded), so no guard/shell redirect loop is possible.
 *
 * In the static preview a cold load of any authenticated URL must render that
 * screen rather than bouncing to sign-in, so the session is seeded in place.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  if (COLOSSUS_PREVIEW) {
    auth.previewSignIn('ADMIN', false);
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
