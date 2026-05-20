/**
 * A resolved theme for a site. Mirrors the `STOREFRONT_CMS_THEME` entity
 * shape after server-side sanitization.
 */
export interface CMSTheme {
  /** Site code this theme belongs to. */
  site: string;
  /**
   * Optional base theme class name (e.g. `medienwerft`). When set, the
   * override `<style>` targets `.theme-<baseTheme>`; otherwise it
   * targets `:root[data-cms-site="<site>"]`.
   */
  baseTheme?: string;
  /**
   * CSS custom properties keyed by `--token` name. Keys and values are
   * already validated against the service's sanitizer — see
   * `EmporixCMSThemeService` for the rules.
   */
  variables: Record<string, string>;
  /** 'draft' | 'live' | ISO timestamp (archived). */
  version: 'draft' | 'live' | string;
  /** Versionless base id (e.g. `cms-theme-main`). */
  baseId: string;
  author?: string;
}

/**
 * Options for {@link CMSThemeService.getThemeForSite}.
 */
export interface GetThemeOptions {
  /**
   * 'draft' | 'live' | 'live-preview' | ISO timestamp. Defaults to
   * 'live'. `'live-preview'` aliases `'live'` but bypasses every cache
   * layer — use it for editor previews where a publish must land on
   * the next request. Draft → live fallback is handled by the API.
   */
  version?: 'draft' | 'live' | 'live-preview' | string;
}

/**
 * Resolves per-site theme overrides. The theme entity is independent
 * from {@link CMSSettingsService} so it can be draft/live-versioned and
 * authored in a dedicated ThemeEditor panel.
 */
export interface CMSThemeService {
  /**
   * Returns the theme for the given site, or `null` when none is
   * defined. A `null` result is the well-defined "use base CSS only"
   * state — callers should not treat it as an error.
   */
  getThemeForSite(site: string, options?: GetThemeOptions): Promise<CMSTheme | null>;
}
