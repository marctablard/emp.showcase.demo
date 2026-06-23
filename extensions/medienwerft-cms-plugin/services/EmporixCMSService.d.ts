import { CMSService } from '@/platform/services/cms/CMSService';
import { CMSNoResult } from '@/platform/services/model/cms';
import { CMSLayout, CMSPage } from '../types';
import type { CMSSiteFallback } from './CMSSettingsService';

/**
 * Options for {@link EmporixCMSService.getPage}.
 */
export interface GetPageOptions {
  /** Optional fallback site/locale used when the primary lookup yields nothing. */
  fallback?: CMSSiteFallback;
  /**
   * When `false`, the service does NOT fetch or merge the page's linked
   * layout. The resulting `CMSPage` contains only the page-owned slots. Use
   * when a wrapping `EmporixCmsLayout` already owns the layout slots.
   * Defaults to `true`.
   */
  loadLayout?: boolean;
  /**
   * When `true`, bypass the live-read cache and always fetch fresh. Set this
   * for editor-mode previews so a just-published change is visible immediately
   * (the live cache otherwise serves the pre-publish version until it revalidates).
   */
  noCache?: boolean;
}

/**
 * Options for {@link EmporixCMSService.getLayout}.
 */
export interface GetLayoutOptions {
  /** Optional fallback site/locale used when the primary lookup yields nothing. */
  fallback?: CMSSiteFallback;
  /** When `true`, bypass the live-read cache (see {@link GetPageOptions.noCache}). */
  noCache?: boolean;
}

/**
 * Extended CMS Service interface with versioning support and explicit layout
 * loading.
 */
export interface EmporixCMSService extends CMSService {
  /**
   * Get a page from CMS (extended with versioning + layout switches).
   *
   * The legacy `fallback` positional argument is preserved for backwards
   * compatibility. New callers should prefer the options object.
   */
  getPage(
    slug: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    fallbackOrOptions?: CMSSiteFallback | GetPageOptions,
  ): Promise<CMSPage | CMSNoResult>;

  /**
   * Get a layout by id. Used by `EmporixCmsLayout` to render layout slots
   * independently from any specific page.
   *
   * @param options - Optional per-call switches. `options.fallback`
   *   triggers the same site/locale fallback matrix used by {@link getPage}.
   */
  getLayout(
    layoutId: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    options?: GetLayoutOptions,
  ): Promise<CMSLayout | CMSNoResult>;
}
