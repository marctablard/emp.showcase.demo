import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isPersonalised, jsonResponse } from '@/app/api/_util/personalised-json-response';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductsModeContext, ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';
import type { SearchService } from '@/platform/services/search/SearchService';

/**
 * API endpoint to get product suggestions based on a search query
 * GET /api/search/suggestions?query=term&locale=en&site=main&currency=EUR
 *
 * Customer segments (COP-4822): the products mode is resolved server-side by `ProductsModeService`
 * (session + `next-products-mode` cookie, never query params). In `assigned` mode `getSuggestions`
 * receives `segmentIds`; `assigned` and `all` responses are `Cache-Control: private, no-store`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  const locale = url.searchParams.get('locale') || undefined;
  const site = url.searchParams.get('site') || undefined;
  const currency = url.searchParams.get('currency') || undefined;
  let ctx: ProductsModeContext | undefined;

  try {
    const searchService = server.get<SearchService>('SearchService');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    ctx = await server.get<ProductsModeService>('ProductsModeService').resolve({
      optInCookieValue: request.cookies.get(PRODUCTS_MODE_COOKIE_NAME)?.value,
      siteCode: site,
    });
    const assigned = ctx.mode === 'assigned';
    const effectiveSite = isPersonalised(ctx) ? (ctx.siteCode ?? site) : site;

    const suggestions = await searchService.getSuggestions({
      query,
      locale,
      site: effectiveSite,
      currency,
      ...(assigned ? { segmentIds: ctx.segmentIds } : {}),
    });

    return jsonResponse(suggestions, isPersonalised(ctx));
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/search/suggestions',
        method: 'GET',
        query,
        locale,
        site,
        mode: ctx?.mode,
      },
      'Error fetching suggestions',
    );
    // Unknown mode (resolve failed) is treated as personalised so a possibly customer-specific
    // error response is never cached.
    return jsonResponse({ error: 'Failed to fetch suggestions' }, ctx === undefined || isPersonalised(ctx), 500);
  }
}
