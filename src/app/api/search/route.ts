import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiRouteDebug } from '@/platform/core/utils/debug-utils';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SearchFilters } from '@/platform/services/model/common';
import type { SearchService } from '@/platform/services/search';
import { extractFiltersFromUrlSearchParams } from '@/utils/filterUtils';

/**
 * API endpoint to search for products
 * GET /api/search?query=term&page=0&size=12&sort=name:asc&site=main&currency=EUR
 *
 * Product search always includes published **navigation** root `categoryIds` in Emporix `q` when
 * `filters.categoryIds` is absent. Requests without resolvable `categoryIds` are not sent upstream.
 * `filters.categoryIds` are passed through as selected id(s); Emporix search includes products from subcategories.
 *
 * Catalog `categoryIds` in product search `q` can be disabled with `NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER=true`
 * (e.g. old DBs without product `categoryIds`). Per-request unscoped search: set `SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH=true`
 * and pass `allProducts=1` or `searchAllProducts=true`.
 */
async function handleSearch(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || undefined;

  try {
    const searchService = server.get<SearchService>('SearchService');
    const page = url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 0;
    const size = url.searchParams.get('size') ? parseInt(url.searchParams.get('size')!) : 12;
    const sort = url.searchParams.get('sort') || undefined;
    const locale = url.searchParams.get('locale') || undefined;
    const site = url.searchParams.get('site') || undefined;
    const currency = url.searchParams.get('currency') || undefined;

    let searchAllProducts = false;
    if (process.env.SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH === 'true') {
      const raw = url.searchParams.get('allProducts') ?? url.searchParams.get('searchAllProducts');
      searchAllProducts = raw === '1' || raw === 'true';
    }

    const filtersRecord = extractFiltersFromUrlSearchParams(url.searchParams);
    const filters: SearchFilters | undefined = Object.keys(filtersRecord).length > 0 ? filtersRecord : undefined;

    const searchResults = await searchService.searchProducts(
      {
        query,
        page,
        size,
        sort,
        filters,
        site: site || undefined,
        locale: locale || undefined,
        currency,
        searchAllProducts,
      },
      locale,
      site,
    );

    return NextResponse.json(searchResults);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/search',
        method: 'GET',
        query,
      },
      'Error searching products',
    );
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}

export const GET = withApiRouteDebug(handleSearch);
