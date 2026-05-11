import { getLogger } from '@/lib/logger/use-logger-client';
import type { SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { ProductSearchResult } from '../types';
import { mapProductToSearchResult } from './product-search';

/**
 * Browser-side orchestrator for the CMS editor's product picker.
 *
 * Combines two existing storefront endpoints:
 * - `GET /api/search` for free-text name matching (wraps
 *   `SearchService.searchProducts`).
 * - `GET /api/products/{id}` for an exact-id/SKU lookup, fired in
 *   parallel when the query is non-empty and looks like a single token.
 *
 * The id lookup is best-effort — a 404 is the expected outcome when the
 * user is mid-typing or searching by name, so it never propagates to
 * the caller. Only the search endpoint failing surfaces an error.
 */
export interface FetchProductSearchArgs {
  site: string;
  locale: string;
  query: string;
  categoryId?: string | null;
  limit?: number;
}

const HARD_CAP = 50;
const DEFAULT_LIMIT = 20;

export async function fetchProductSearch(args: FetchProductSearchArgs): Promise<ProductSearchResult[]> {
  const { site, locale, query, categoryId, limit } = args;
  const size = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), HARD_CAP);

  const trimmedQuery = query.trim();
  const idLookupCandidate = trimmedQuery && !/\s/.test(trimmedQuery) ? trimmedQuery : null;

  const searchUrl = new URL('/api/search', window.location.origin);
  searchUrl.searchParams.set('size', String(size));
  searchUrl.searchParams.set('site', site);
  searchUrl.searchParams.set('locale', locale);
  if (trimmedQuery) {
    searchUrl.searchParams.set('query', trimmedQuery);
  }
  if (categoryId) {
    searchUrl.searchParams.set('filters[categoryIds]', categoryId);
  }

  const searchPromise = fetch(searchUrl.toString()).then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      getLogger().error(
        {
          status: response.status,
          statusText: response.statusText,
          errorData,
          site,
          locale,
          query: trimmedQuery,
        },
        'Error response from /api/search',
      );
      throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as SearchResult<Product>;
  });

  const idPromise: Promise<Product | null> = idLookupCandidate
    ? fetch(`/api/products/${encodeURIComponent(idLookupCandidate)}`).then(
        async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as Product;
        },
        () => null,
      )
    : Promise.resolve(null);

  const [searchSettled, idSettled] = await Promise.allSettled([searchPromise, idPromise]);

  if (searchSettled.status === 'rejected') {
    throw searchSettled.reason instanceof Error ? searchSettled.reason : new Error(String(searchSettled.reason));
  }

  const searchResult = searchSettled.value;
  const exactMatch = idSettled.status === 'fulfilled' ? idSettled.value : null;

  const merged: Product[] = [];
  const seen = new Set<string>();

  if (exactMatch?.id) {
    merged.push(exactMatch);
    seen.add(exactMatch.id);
  }

  for (const item of searchResult.items ?? []) {
    if (item.id && !seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }

  return merged.map((p) => mapProductToSearchResult(p, locale));
}
