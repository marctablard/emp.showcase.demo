/**
 * Per-site fallback shape used by the CMS when the primary page/layout
 * lookup returns nothing.
 *
 * Both fields are independent — the caller may choose to override only
 * the site, only the locale, or both. `undefined` means no fallback for
 * that dimension.
 */
export interface CMSSiteFallback {
  /** Fallback site code. `undefined` / empty means no site fallback. */
  site?: string;
  /** Fallback locale. `undefined` / empty means no locale fallback. */
  locale?: string;
}

/**
 * Operational CMS settings sourced from `STOREFRONT_CMS_SETTINGS` (one
 * entity per tenant, owned by the editor team).
 *
 * Only the subset used by the extension is exposed — additional settings
 * attributes stay private to the editor and the storefront core.
 *
 * Designed as an interface so a host storefront can swap the default
 * Emporix implementation (e.g. for tests or a different backend) without
 * touching the consumers.
 */
export interface CMSSettingsService {
  /**
   * Returns the configured fallback for a given site, or `undefined`
   * when no entry exists.
   *
   * Implementations should cache the underlying settings entity (e.g.
   * via `unstable_cache` with the tags exposed from
   * `lib/cms-settings.ts`) so per-request lookups are cheap.
   */
  getSiteFallback(site: string): Promise<CMSSiteFallback | undefined>;
}
