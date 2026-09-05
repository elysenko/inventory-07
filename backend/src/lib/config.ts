import { PrismaClient } from '@prisma/client';

/**
 * Sentinel a deploy writes when it mounts a key it has no real value for.
 * Treated as "not set" everywhere so a placeholder never reaches a client SDK.
 */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/** True when a value is absent, blank, or the deploy-time placeholder. */
export function isUnconfigured(value: string | null | undefined): boolean {
  return !value || !value.trim() || value === PLACEHOLDER;
}

/**
 * Resolve one config key: environment first, then the `SystemSetting` override
 * an admin can write from the settings screen, then null.
 *
 * Returning null rather than throwing is deliberate — a missing third-party
 * credential must degrade that one feature at call time, never crash the pod at
 * boot. Callers check for null and report the feature as unconfigured.
 */
export async function resolveConfig(
  prisma: Pick<PrismaClient, 'systemSetting'>,
  key: string,
): Promise<string | null> {
  const fromEnv = process.env[key];
  if (!isUnconfigured(fromEnv)) {
    return fromEnv as string;
  }

  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (row && !isUnconfigured(row.value)) {
    return row.value;
  }

  return null;
}
