/**
 * Namespaced browser storage.
 *
 * Mockups are served many-per-origin at `/<mockup_id>/` and storage is
 * origin-scoped, not path-scoped — so every key is prefixed with the first
 * URL path segment to stop one preview clobbering another. The colon
 * separator is load-bearing: tooling seeds `<segment>:<key>` directly.
 */
const NS =
  (typeof location !== 'undefined' && location.pathname.split('/')[1]) || 'app';

export const nsKey = (key: string): string => `${NS}:${key}`;

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(nsKey(key));
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(nsKey(key), value);
  } catch {
    /* storage unavailable (private mode / disabled) — preview still works */
  }
}

export function clearStored(...keys: string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(nsKey(key));
    } catch {
      /* ignore */
    }
  }
}
