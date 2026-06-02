/**
 * Single source of truth for href sanitisation across every CMS render path
 * and integration-boundary mapper.
 *
 * Allowlist (case-insensitive; leading/trailing ASCII whitespace trimmed):
 *  - `https:` / `http:`  — standard web links
 *  - `mailto:`           — email links
 *  - `tel:`              — telephone links
 *  - relative `/…`       — internal navigation
 *  - anchor `#…`         — in-page navigation
 *
 * Anything else (e.g. `javascript:`, `data:`, `vbscript:`, `file:`) is stripped
 * to `''` so the renderer emits an inert `href=""`.
 *
 * Lives in `src/lib/` so the same implementation is reachable from both
 * `src/components/cms/**` (UI defense-in-depth) and
 * `src/platform/integrations/**` (boundary sanitisation) without crossing
 * the integration → service → React layering.
 */

const SAFE_HREF_RE = /^(?:https?:\/\/|mailto:|tel:|\/|#)/i;

export const sanitizeHref = (href: string | null | undefined): string => {
  if (typeof href !== 'string') {
    return '';
  }
  const trimmed = href.trim();
  return SAFE_HREF_RE.test(trimmed) ? trimmed : '';
};

export default sanitizeHref;
