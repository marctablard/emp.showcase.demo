/**
 * Raw, Emporix-shaped theme payload. Returned by
 * {@link EmporixCmsThemeApi.getThemeEntity} before the service applies
 * sanitization and draft→live fallback.
 */
export interface RawCmsTheme {
  /** The actual entity id returned by Emporix (includes version suffix). */
  id: string;
  site: string;
  baseTheme?: string;
  /** `variables` is stored as JSON-encoded TEXT; already decoded here. */
  variables: Record<string, string>;
  /** 'draft' | 'live' | ISO timestamp. */
  version: 'draft' | 'live' | string;
  /** Versionless base id (e.g. `cms-theme-main`). */
  baseId: string;
  author?: string;
}

/**
 * Thin API abstraction for reading theme entities from Emporix. The
 * service layer adds caching, draft→live fallback, and validation.
 */
export interface EmporixCmsThemeApi {
  /**
   * Returns the decoded theme entity for the given site/version, or
   * `null` when no row exists. Must **not** throw for a missing entity
   * — a missing theme is the "no overrides" state.
   *
   * `'live-preview'` aliases `'live'` but bypasses the Next data-cache
   * window so a publish lands on the next call. `'draft'` falls back
   * to `'live-preview'` internally when no draft row exists; the
   * returned `version` reports the stored discriminator so callers can
   * detect that a fallback occurred.
   */
  getThemeEntity(site: string, version?: 'draft' | 'live' | 'live-preview' | string): Promise<RawCmsTheme | null>;
}
