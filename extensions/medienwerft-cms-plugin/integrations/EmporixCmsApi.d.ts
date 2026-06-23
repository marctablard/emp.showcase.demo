import { CMSLayout, CMSPage } from '../types';

/**
 * Optional switches for {@link EmporixCmsApi.getPage}.
 */
export interface GetPageOptions {
  /**
   * When `false`, the API does NOT fetch or merge the page's linked layout.
   * The resulting `CMSPage` will only contain page-owned slots (no top/bottom
   * layout slots). Use when an outer `EmporixCmsLayout` is already rendering
   * the layout slots. Defaults to `true` for backwards compatibility.
   */
  loadLayout?: boolean;
  /**
   * When `true`, bypass the live-read cache and always fetch fresh. Used for
   * editor-mode previews so just-published changes appear immediately.
   */
  noCache?: boolean;
}

/**
 * Optional switches for {@link EmporixCmsApi.getLayout}. Kept intentionally
 * narrow — the richer fallback semantics live in the service layer.
 */
export interface GetLayoutOptions {
  /**
   * When `true`, bypass the live-read cache and always fetch fresh. Used for
   * editor-mode previews so just-published changes appear immediately.
   */
  noCache?: boolean;
}

/**
 * API abstraction for CMS page storage backed by Emporix Custom Entities.
 *
 * Encapsulates all Emporix-specific details (entity types, mixin keys,
 * ID conventions, entity-to-page mapping) so that the CMS service layer
 * remains free of integration logic.
 */
export interface EmporixCmsApi {
  /**
   * Retrieve a single CMS page by its slug, locale and site.
   * Returns null when no matching entity exists.
   * @param version - Optional version to load (draft, live, or timestamp). Defaults to live.
   * @param options - Per-call switches (e.g. skip layout loading).
   */
  getPage(
    slug: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    options?: GetPageOptions,
  ): Promise<CMSPage | null>;

  /**
   * Retrieve a single CMS layout by its id, locale and site.
   * Returns null when no matching entity exists.
   */
  getLayout(
    layoutId: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    options?: GetLayoutOptions,
  ): Promise<CMSLayout | null>;
}
