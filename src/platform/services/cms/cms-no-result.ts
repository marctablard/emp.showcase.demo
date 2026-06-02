import type { CMSNoResult } from '../model/cms';

/**
 * Single source of truth for the CMS "no content" discriminator.
 *
 * The CMS SPI surfaces a miss as `{ notfound: true }`; real
 * `CMSPage`/`CMSLayout`/`CMSNavigation` payloads never carry a `notfound` key.
 * The guard tests presence-with-`true` (not mere key presence) so it stays
 * congruent with the tightened `CMSNoResult.notfound: true` type and never
 * mis-classifies a hypothetical `{ notfound: false }`.
 *
 * Both the `FallbackCmsAdapter` and the `DelegatingCmsServiceSSR` facade route
 * through this guard so the two layers cannot diverge on what counts as a miss.
 */
export function isCmsNoResult(value: unknown): value is CMSNoResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'notfound' in value &&
    (value as { notfound?: unknown }).notfound === true
  );
}
