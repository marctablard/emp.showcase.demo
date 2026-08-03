/**
 * Single source of truth for href sanitisation across every CMS render path
 * and integration-boundary mapper.
 *
 * Allowlist (case-insensitive; leading/trailing ASCII whitespace trimmed):
 *  - `https:` / `http:`  — standard web links
 *  - `mailto:`           — email links
 *  - `tel:`              — telephone links
 *  - relative `/…`       — internal navigation, single leading slash only
 *  - anchor `#…`         — in-page navigation
 *
 * Anything else (e.g. `javascript:`, `data:`, `vbscript:`, `file:`) is stripped
 * to `''` so the renderer emits an inert `href=""`.
 *
 * Protocol-relative URLs (`//evil.example`) are rejected: browsers resolve them
 * against the current scheme and navigate off-site, so a bare `//` would let
 * untrusted external navigation back through an allowlist meant for internal
 * paths.
 *
 * Lives in `src/lib/` so the same implementation is reachable from both
 * `src/components/cms/**` (UI defense-in-depth) and
 * `src/platform/integrations/**` (boundary sanitisation) without crossing
 * the integration → service → React layering.
 */

const SAFE_HREF_RE = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

export const sanitizeHref = (href: string | null | undefined): string => {
  if (typeof href !== 'string') {
    return '';
  }
  const trimmed = href.trim();
  return SAFE_HREF_RE.test(trimmed) ? trimmed : '';
};

/** Schemes that leave the app and therefore must not go through the router. */
const EXTERNAL_HREF_RE = /^(?:https?:\/\/|mailto:|tel:)/i;

/**
 * True when an href must render as a plain `<a>` instead of the i18n `Link`,
 * which rewrites and site-prefixes whatever it is given.
 *
 * Always call this on the *sanitised* href, never on raw CMS input: deciding
 * from the raw value misclassifies uppercase schemes (`HTTPS://…`) and both
 * `mailto:`/`tel:` as internal, and would route a value that sanitised away to
 * `''` into the internal link path.
 */
export const isExternalHref = (href: string): boolean => EXTERNAL_HREF_RE.test(href);

export default sanitizeHref;
