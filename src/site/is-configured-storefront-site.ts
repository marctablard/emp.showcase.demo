import { routing } from '@/site/routing';

/**
 * True when `siteCode` is a configured storefront site (avoids bogus `publishedSite` / catalog calls).
 * Shared by catalog-root resolution and public category APIs.
 */
export function isConfiguredStorefrontSiteCode(siteCode: string): boolean {
  const trimmed = siteCode.trim();
  if (!trimmed) {
    return false;
  }
  return routing.availableSites.includes(trimmed);
}
