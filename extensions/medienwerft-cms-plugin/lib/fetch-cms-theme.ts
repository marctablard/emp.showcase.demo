import { cache } from 'react';
import ssr from '@/platform/ssr';
import type { CMSTheme, CMSThemeService, GetThemeOptions } from '../services/CMSThemeService';

/**
 * Per-request cached theme fetch.
 *
 * React's `cache()` is request-scoped; the underlying Emporix read uses
 * `next: { revalidate: 300 }` so identical fetches share Next's data
 * cache across warm lambda invocations. Combined:
 *  - Single fetch per (site, version) within one render tree (React).
 *  - Single Emporix round-trip across requests within the TTL window.
 *
 * Returns `null` when no `CMSThemeService` is bound (e.g. the extension
 * ships the interface but the host has not registered the implementation)
 * or when no override is configured for the site; the caller renders the
 * base theme only in that case.
 *
 * TODO: If this extension ever ships non-React component variants, split
 * the React `cache()` wrapper out of this file into a framework-neutral
 * accessor + a thin `fetch-*` wrapper. Today every consumer is a React
 * Server Component, so the inline one-file shape matches the rest of the
 * `fetch-*` helpers in `lib/`.
 */
export const fetchCMSTheme = cache(
  async (site: string, version?: 'draft' | 'live' | string): Promise<CMSTheme | null> => {
    if (!ssr.isBound('CMSThemeService')) return null;
    const service = ssr.get<CMSThemeService>('CMSThemeService');
    const options: GetThemeOptions | undefined = version ? { version } : undefined;
    return service.getThemeForSite(site, options);
  },
);
