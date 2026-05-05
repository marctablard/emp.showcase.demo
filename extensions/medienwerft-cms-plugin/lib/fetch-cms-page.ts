import { cache } from 'react';
import { CMSNoResult } from '@/platform/services/model/cms';
import ssr from '@/platform/ssr';
import type { EmporixCMSService, GetLayoutOptions, GetPageOptions } from '../services/EmporixCMSService';
import { CMSLayout, CMSPage } from '../types';

/**
 * Fetch CMS page data from the CMSService.
 *
 * Cached with React `cache()` for per-request deduplication. The cache key
 * is the full argument list, so passing different `options` produces
 * different entries — in practice callers pass a stable options object
 * per route.
 *
 * @param version Optional version to load (draft, live, or timestamp).
 * @param options Fetch options (fallback, layout loading switch).
 */
export const fetchCMSPage = cache(
  async (
    slug: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    options?: GetPageOptions,
  ): Promise<CMSPage | CMSNoResult> => {
    const cmsService = ssr.get<EmporixCMSService>('EmporixCMSService');
    return cmsService.getPage(slug, locale, site, version, options) as Promise<CMSPage | CMSNoResult>;
  },
);

/**
 * Fetch a standalone CMS layout. Cached per request.
 *
 * Accepts {@link GetLayoutOptions} so callers can forward a per-site
 * fallback tuple (typically resolved via `CMSSettingsService`). When no
 * options are provided the layout is loaded using the exact tuple only.
 */
export const fetchCMSLayout = cache(
  async (
    layoutId: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    options?: GetLayoutOptions,
  ): Promise<CMSLayout | CMSNoResult> => {
    const cmsService = ssr.get<EmporixCMSService>('EmporixCMSService');
    return cmsService.getLayout(layoutId, locale, site, version, options);
  },
);
