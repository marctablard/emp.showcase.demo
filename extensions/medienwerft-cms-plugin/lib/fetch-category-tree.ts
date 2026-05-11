import { getLogger } from '@/lib/logger/use-logger-client';
import type { Category } from '@/platform/services/model/category';

/**
 * Browser-side fetcher for the storefront's category tree endpoint.
 *
 * Delegated to by `useCMSLiveEditor` when the editor asks for the available
 * category tree (`REQUEST_CATEGORY_TREE`). Lives inside the extension so the
 * full chain — route handler → client fetch → tree shaping — is owned by the
 * plugin rather than scattered across the host storefront.
 *
 * The matching server route is mounted by re-exporting `categoryTreeGET`
 * from `@extensions/medienwerft-cms-plugin/route-handlers` at
 * `src/app/api/cms/categories/tree/route.ts`.
 */

/**
 * Fetch all category trees available for a given site. The backend resolves
 * each catalog published to the site, returning one tree per catalog root.
 *
 * @param site The site code
 * @param showUnpublished Whether to include unpublished categories
 * @returns Array of category trees (one per catalog root). Empty when the
 *          site has no published catalogs.
 */
export async function fetchCategoryTreesForSite(site: string, showUnpublished: boolean = false): Promise<Category[]> {
  try {
    const url = new URL('/api/cms/categories/tree', window.location.origin);
    url.searchParams.append('site', site);
    if (showUnpublished) {
      url.searchParams.append('showUnpublished', 'true');
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      getLogger().error(
        {
          status: response.status,
          statusText: response.statusText,
          errorData,
          site,
        },
        'Error response from /api/cms/categories/tree (site mode)',
      );
      throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    getLogger().error({ err: error, site }, 'Error fetching category trees for site');
    throw error;
  }
}
