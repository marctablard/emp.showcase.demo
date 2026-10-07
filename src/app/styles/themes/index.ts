/**
 * Per-site theme registry.
 *
 * Maps a site code to the public CSS file that overrides the differing
 * design tokens for that site. The CSS lives under `public/themes/` so it is
 * served as a static stylesheet and loaded via a `<link>` (see
 * `SiteThemeStyle`), keeping per-site overrides out of the Tailwind
 * `@theme inline` block and the JS bundle.
 *
 * ADR-0001 / drift-guard: this module is pure data + a resolver. It MUST NOT
 * import from `@/platform/integrations/*` or any provider/DI/provider-context
 * layer — the theme layer is a leaf with zero coupling to data sources.
 */

/** Href served for a site without an explicit theme file. */
export const DEFAULT_THEME_HREF = '/themes/_default_.css';

/** Site code used as the fallback theme key. */
export const DEFAULT_THEME_KEY = '_default_';

/**
 * Known site → theme-file map. A site absent here falls back to the
 * (deliberately empty) default theme, so an un-themed site never inherits
 * another site's overrides.
 */
export const THEME_MAP: Readonly<Record<string, string>> = {
  main: '/themes/main.css',
  'us-branch': '/themes/us-branch.css',
  showcase: '/themes/showcase.css',
};

/**
 * Resolves the stylesheet href for a site code, falling back to the empty
 * default theme when the site has no explicit theme file (or no site code is
 * supplied). The fallback is the neutral storefront look — it adds no
 * `:root` overrides, so it cannot cascade onto other sites.
 */
export function resolveThemeForSite(siteCode: string | null | undefined): string {
  if (!siteCode) {
    return DEFAULT_THEME_HREF;
  }
  return THEME_MAP[siteCode] ?? DEFAULT_THEME_HREF;
}
