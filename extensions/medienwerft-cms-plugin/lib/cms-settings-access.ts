import { cache } from 'react';
import ssr from '@/platform/ssr';
import type { CMSSettingsService, CMSSiteFallback } from '../services/CMSSettingsService';

/**
 * Per-request cached accessor for the CMS Settings service.
 *
 * Wrapped in React's `cache()` so the same render tree resolves the
 * per-site fallback at most once even when both `EmporixCmsLayout` and
 * `EmporixCmsPage` ask for it. The underlying Emporix read uses
 * `next: { revalidate: 300 }` for cross-request caching.
 *
 * Returns `undefined` when the service is not bound (e.g. the extension
 * was dropped into a host storefront that has not yet implemented /
 * generated DI for settings). Callers then fall back to their previous
 * hard-coded defaults without breaking.
 *
 * TODO: If this extension ever ships non-React component variants, split
 * the React `cache()` wrapper out of this file into a framework-neutral
 * DI accessor + a thin `fetch-*` wrapper. Today every consumer is a
 * React Server Component, so the inline one-file shape matches the rest
 * of the `fetch-*` helpers in `lib/`.
 */
export const getSiteFallback = cache(async (site: string): Promise<CMSSiteFallback | undefined> => {
  if (!ssr.isBound('CMSSettingsService')) return undefined;
  const service = ssr.get<CMSSettingsService>('CMSSettingsService');
  return service.getSiteFallback(site);
});
