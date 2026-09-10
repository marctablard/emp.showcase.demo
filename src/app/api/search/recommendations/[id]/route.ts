import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductsModeContext, ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';
import type { SearchService } from '@/platform/services/search/SearchService';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** Personalised responses (segmented customer, assigned or opted-in `all`) must never be cached. */
function isPersonalised(ctx: ProductsModeContext | undefined): boolean {
  return ctx?.mode === 'assigned' || ctx?.mode === 'all';
}

function jsonResponse(body: unknown, personalised: boolean, status: number = 200): NextResponse {
  return NextResponse.json(body, personalised ? { status, headers: PRIVATE_NO_STORE } : { status });
}

/**
 * API endpoint to get product recommendations based on a product ID
 * GET /api/search/recommendations/[id]?size=12
 *
 * Customer segments (COP-4822): the products mode is resolved server-side by `ProductsModeService`
 * from the session and the `next-products-mode` opt-in cookie — never from query params. In
 * `assigned` mode the engine receives `segmentIds` and the response is `Cache-Control: private,
 * no-store`; `all` mode is also private. `anonymous` / `unsegmented` keep the previous behaviour.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const url = new URL(request.url);
  const sizeRaw = url.searchParams.get('size');
  const parsedSize = sizeRaw ? parseInt(sizeRaw, 10) : NaN;
  const limit = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 12;
  let ctx: ProductsModeContext | undefined;

  try {
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    ctx = await server.get<ProductsModeService>('ProductsModeService').resolve({
      optInCookieValue: request.cookies.get(PRODUCTS_MODE_COOKIE_NAME)?.value,
    });
    const assigned = ctx.mode === 'assigned';
    // One site for mode, scope and engine call when the response is personalised.
    const effectiveSite = isPersonalised(ctx) ? ctx.siteCode : undefined;

    const searchService = server.get<SearchService>('SearchService');
    const recommendations = await searchService.getRecommendations(
      productId,
      undefined,
      effectiveSite,
      limit,
      undefined,
      assigned ? { segmentIds: ctx.segmentIds } : undefined,
    );

    return jsonResponse({ products: recommendations }, isPersonalised(ctx));
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/search/recommendations/${productId}`,
        method: 'GET',
        productId,
        mode: ctx?.mode,
      },
      'Error fetching product recommendations',
    );
    // Unknown mode (resolve failed) is treated as personalised so a possibly customer-specific
    // error response is never cached.
    return jsonResponse(
      { error: 'Failed to fetch product recommendations' },
      ctx === undefined || isPersonalised(ctx),
      500,
    );
  }
}
