import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * API endpoint to get variants for a specific product by ID
 * GET /api/products/[id]/variants
 *
 * COP-4822: the products mode is resolved server-side (opt-in cookie + `site`/`priceSiteCode`);
 * in `assigned` mode the variants are filtered by the service through `{ segmentIds, siteCode }`
 * (the effective site the mode was resolved for). `segmentIds` is never read from the request.
 * Caching fails closed: every response starts as `Cache-Control: private, no-store` and is relaxed
 * only once the mode is known to be `anonymous` / `unsegmented`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const { searchParams } = new URL(request.url);

  // Fail closed on caching: private until the mode is known to be non-personalised.
  let headers: Record<string, string> | undefined = PRIVATE_NO_STORE;

  try {
    const requestSite = searchParams.get('site') ?? searchParams.get('priceSiteCode') ?? undefined;
    const productsModeService = server.get<ProductsModeService>('ProductsModeService');
    const ctx = await productsModeService.resolve({
      optInCookieValue: request.cookies.get(PRODUCTS_MODE_COOKIE_NAME)?.value,
      siteCode: requestSite,
    });
    if (ctx.mode === 'anonymous' || ctx.mode === 'unsegmented') {
      headers = undefined;
    }

    const productService = server.get<ProductService>('ProductService');

    const variants =
      ctx.mode === 'assigned'
        ? await productService.getVariantProducts(productId, {
            segmentIds: ctx.segmentIds,
            siteCode: ctx.siteCode ?? requestSite,
          })
        : await productService.getVariantProducts(productId);

    if (!variants || variants.length === 0) {
      return NextResponse.json({ variants: [] }, { headers });
    }

    return NextResponse.json({ variants }, { headers });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/products/${productId}/variants`,
        method: 'GET',
        productId,
      },
      'Error fetching product variants',
    );
    return NextResponse.json({ error: 'Failed to fetch product variants' }, { status: 500, headers });
  }
}
