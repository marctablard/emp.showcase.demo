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
   */
  getThemeEntity(site: string, version?: 'draft' | 'live' | string): Promise<RawCmsTheme | null>;
}
