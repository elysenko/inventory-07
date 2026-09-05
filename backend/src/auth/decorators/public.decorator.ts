import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt a route out of the globally registered JwtAuthGuard.
 *
 * The guard is an APP_GUARD, so every endpoint is 401-by-default; this is the
 * only way to expose one anonymously (login, signup, health).
 */
export const Public = (): CustomDecorator<string> =>
  SetMetadata(IS_PUBLIC_KEY, true);
