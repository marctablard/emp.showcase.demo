import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import { sanitizeCategoryFilters } from '@/lib/search/sanitize-category-filters';
import { withApiRouteDebug } from '@/platform/core/utils/debug-utils';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SearchFilters } from '@/platform/services/model/common';
import type { ProductsModeContext, ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';
import type { SearchService } from '@/platform/services/search';
import type SegmentFilterService from '@/platform/services/search/impl/SegmentFilterService';
import { extractFiltersFromUrlSearchParams } from '@/utils/filterUtils';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** Personalised responses (segmented customer, assigned or opted-in `all`) must never be cached. */
function isPersonalised(ctx: ProductsModeContext | undefined): boolean {
  return ctx?.mode === 'assigned' || ctx?.mode === 'all';
}

function jsonResponse(body: unknown, personalised: boolean, status: number = 200): NextResponse {
  return NextResponse.json(body, personalised ? { status, headers: PRIVATE_NO_STORE } : { status });
}

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
 *
 * Customer segments (COP-4822): the products mode is resolved server-side by `ProductsModeService`
 * from the session and the `next-products-mode` opt-in cookie — never from query params or body.
 * In `assigned` mode the engine receives `segmentIds`, `filters.categoryIds` is sanitised against the
 * segment category scope (AC5), `searchAllProducts` is forced to `false` (Open Question 20) and the
 * response is `Cache-Control: private, no-store`; `all` mode is also private. `anonymous` and
 * `unsegmented` requests keep the previous behaviour and headers.
 */
async function handleSearch(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || undefined;
  let ctx: ProductsModeContext | undefined;

  try {
    const site = url.searchParams.get('site') || undefined;
    ctx = await server.get<ProductsModeService>('ProductsModeService').resolve({
      optInCookieValue: request.cookies.get(PRODUCTS_MODE_COOKIE_NAME)?.value,
      siteCode: site,
    });
    const assigned = ctx.mode === 'assigned';
    // One site for mode, scope and engine call when the response is personalised.
    const effectiveSite = isPersonalised(ctx) ? (ctx.siteCode ?? site) : site;

    const searchService = server.get<SearchService>('SearchService');
    const page = url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 0;
    const size = url.searchParams.get('size') ? parseInt(url.searchParams.get('size')!) : 12;
    const sort = url.searchParams.get('sort') || undefined;
    const locale = url.searchParams.get('locale') || undefined;
    const currency = url.searchParams.get('currency') || undefined;

    let searchAllProducts = false;
    if (!assigned && process.env.SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH === 'true') {
      const raw = url.searchParams.get('allProducts') ?? url.searchParams.get('searchAllProducts');
      searchAllProducts = raw === '1' || raw === 'true';
    }

    const filtersRecord = extractFiltersFromUrlSearchParams(url.searchParams);
    let filters: SearchFilters | undefined = Object.keys(filtersRecord).length > 0 ? filtersRecord : undefined;

    if (assigned) {
      // AC5: a client-supplied category filter outside the segment scope is dropped, never widened.
      // Without a resolvable site the scope cannot be loaded → fail closed with an empty allow-list.
      const allowedCategoryIds = effectiveSite
        ? (
            await server
              .get<SegmentFilterService>('SegmentFilterService')
              .getCategoryScope(effectiveSite, ctx.segmentIds)
          ).allowedCategoryIds
        : [];
      filters = sanitizeCategoryFilters(filters, allowedCategoryIds);
    }

    const searchResults = await searchService.searchProducts(
      {
        query,
        page,
        size,
        sort,
        filters,
        site: effectiveSite,
        locale,
        currency,
        searchAllProducts,
        ...(assigned ? { segmentIds: ctx.segmentIds } : {}),
      },
      locale,
      effectiveSite,
    );

    return jsonResponse(searchResults, isPersonalised(ctx));
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/search',
        method: 'GET',
        query,
        mode: ctx?.mode,
      },
      'Error searching products',
    );
    // Unknown mode (resolve failed) is treated as personalised so a possibly customer-specific
    // error response is never cached.
    return jsonResponse({ error: 'Failed to search products' }, ctx === undefined || isPersonalised(ctx), 500);
  }
}

export const GET = withApiRouteDebug(handleSearch);
