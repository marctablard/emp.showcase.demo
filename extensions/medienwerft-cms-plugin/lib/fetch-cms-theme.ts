import { cache } from 'react';
import type { CMSTheme, GetThemeOptions } from '../services/CMSThemeService';
import { getThemeForSite } from './cms-theme-access';

/**
 * Per-request cached theme fetch.
 *
 * React's `cache()` is request-scoped; the underlying Emporix read uses
 * `next: { revalidate: 300 }` so identical fetches share Next's data
 * cache across warm lambda invocations. Combined:
 *  - Single fetch per (site, version) within one render tree (React).
 *  - Single Emporix round-trip across requests within the TTL window.
 *
 * Falls back to `null` when no override is configured; the caller
 * renders the base theme only in that case.
 */
export const fetchCMSTheme = cache(
  async (site: string, version?: 'draft' | 'live' | string): Promise<CMSTheme | null> => {
    const options: GetThemeOptions | undefined = version ? { version } : undefined;
    return getThemeForSite(site, options);
  },
);
