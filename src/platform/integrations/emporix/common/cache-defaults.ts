/**
 * Shared default revalidation time (in seconds) for opt-in Next `fetch`
 * caching on Emporix integration calls. Passed as the trailing `cacheSeconds`
 * argument to `authenticatedFetch` from cacheable GET/HEAD callers.
 *
 * Env knob:
 *
 *   NEXT_PUBLIC_CACHE_DEFAULT_REVALIDATE=<seconds>
 *
 * The `NEXT_PUBLIC_` prefix is required because this module can be evaluated
 * from the client DI container graph. Next.js only inlines `NEXT_PUBLIC_*`
 * env vars into the browser bundle; non-public vars resolve to `undefined` in
 * the client and the override would be silently lost.
 *
 * The HTTP cache middleware (`src/caching/cache-config.ts` →
 * `DEFAULT_CACHE_REVALIDATE`) reads the same env so a single setting controls
 * the default revalidation window across both layers.
 *
 * Non-positive or non-numeric values fall back to the built-in default.
 *
 * The integration module intentionally does not import from `src/caching/**`
 * to keep the integration layer decoupled from the HTTP cache middleware;
 * the parsing is duplicated on purpose.
 */
const FALLBACK_DEFAULT_CACHE_REVALIDATE = 3600;

function resolveDefaultCacheRevalidate(): number {
  const raw = process.env.NEXT_PUBLIC_CACHE_DEFAULT_REVALIDATE;
  if (raw === undefined || raw === null || raw.trim() === '') {
    return FALLBACK_DEFAULT_CACHE_REVALIDATE;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return FALLBACK_DEFAULT_CACHE_REVALIDATE;
  }
  return Math.floor(parsed);
}

export const DEFAULT_CACHE_REVALIDATE = resolveDefaultCacheRevalidate();
