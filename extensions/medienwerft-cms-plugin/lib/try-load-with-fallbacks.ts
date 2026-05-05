import type { CMSSiteFallback } from '../services/CMSSettingsService';

/**
 * Loader signature used by {@link tryLoadWithFallbacks}. Returns the
 * loaded entity or `null` when not found. Errors propagate up — the
 * helper only coordinates the fallback matrix, not error handling.
 */
export type FallbackLoader<T> = (
  locale: string,
  site: string,
  version?: 'draft' | 'live' | string,
) => Promise<T | null>;

/**
 * Options for {@link tryLoadWithFallbacks}.
 */
export interface TryLoadOptions {
  locale: string;
  site: string;
  version?: 'draft' | 'live' | string;
  /** Per-site fallback (site + locale). Either/both may be undefined. */
  fallback?: CMSSiteFallback;
}

/**
 * Attempt a `loader` against progressively looser (locale, site, version)
 * tuples until one succeeds. The full attempt matrix is:
 *
 *  1. `(site, locale, version)` — exact requested tuple.
 *  2. `(site, locale, 'live')` — only when `version === 'draft'`,
 *     mirrors the "draft falls back to live" rule the legacy
 *     `EmporixCMSService.getPage` used to hard-code.
 *  3. `(site, fallback.locale, version)` — swap locale.
 *  4. `(fallback.site, locale, version)` — swap site.
 *  5. `(fallback.site, fallback.locale, version)` — swap both.
 *
 * Each step is only attempted when the inputs change compared to the
 * previous call, so no duplicate loader invocations are made when
 * `fallback.site === site` / `fallback.locale === locale`.
 *
 * The helper is intentionally pure (no logging, no error handling) so
 * the caller can wrap it in service-specific try/catch + telemetry.
 */
export async function tryLoadWithFallbacks<T>(loader: FallbackLoader<T>, opts: TryLoadOptions): Promise<T | null> {
  const { locale, site, version, fallback } = opts;
  const attempted = new Set<string>();

  const attempt = async (l: string, s: string, v?: string): Promise<T | null> => {
    const key = `${s}::${l}::${v ?? ''}`;
    if (attempted.has(key)) return null;
    attempted.add(key);
    return loader(l, s, v);
  };

  let result = await attempt(locale, site, version);
  if (result) return result;

  if (version === 'draft') {
    result = await attempt(locale, site, 'live');
    if (result) return result;
  }

  if (!fallback) return null;
  const fbLocale = fallback.locale;
  const fbSite = fallback.site;

  if (fbLocale) {
    result = await attempt(fbLocale, site, version);
    if (result) return result;
  }
  if (fbSite) {
    result = await attempt(locale, fbSite, version);
    if (result) return result;
  }
  if (fbLocale && fbSite) {
    result = await attempt(fbLocale, fbSite, version);
    if (result) return result;
  }

  return null;
}
