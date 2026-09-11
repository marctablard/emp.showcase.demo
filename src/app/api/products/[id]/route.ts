import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { PriceFetchOptions } from '@/platform/services/price/PriceService';
import type { ProductFetchOptions } from '@/platform/services/product/ProductService';
import type { ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';
import type { SearchService } from '@/platform/services/search/SearchService';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * API endpoint to get a specific product by ID
 * GET /api/products/[id]?variants=true&prices=true&categories=true
 *
 * COP-4822: the products mode is resolved server-side (opt-in cookie + `site`/`priceSiteCode`);
 * in `assigned` mode the segment scope (`segmentIds` + the effective `siteCode` the mode was
 * resolved for) is added to the fetch options and an out-of-scope product yields the regular 404.
 * `segmentIds` is never read from the request. Caching fails closed: every response starts as
 * `Cache-Control: private, no-store` and is relaxed only once the mode is known to be
 * `anonymous` / `unsegmented`, so a failure while resolving the mode never yields a cacheable body.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const includeVariants = searchParams.get('variants') === 'true';
  const includePrices = searchParams.get('prices') === 'true';
  const includeCategories = searchParams.get('categories') === 'true';
  const priceSiteCode = searchParams.get('priceSiteCode') || undefined;
  const priceCurrency = searchParams.get('priceCurrency') || undefined;
  const priceCountry = searchParams.get('priceCountry') || undefined;
  let priceOptions: true | PriceFetchOptions = true;

  if (priceSiteCode) {
    priceOptions = {
      siteCode: priceSiteCode,
      currency: priceCurrency,
      country: priceCountry,
    };
  }

  // Fail closed on caching: private until the mode is known to be non-personalised.
  let headers: Record<string, string> | undefined = PRIVATE_NO_STORE;

  try {
    const requestSite = searchParams.get('site') ?? priceSiteCode;
    const productsModeService = server.get<ProductsModeService>('ProductsModeService');
    const ctx = await productsModeService.resolve({
      optInCookieValue: request.cookies.get(PRODUCTS_MODE_COOKIE_NAME)?.value,
      siteCode: requestSite,
    });
    if (ctx.mode === 'anonymous' || ctx.mode === 'unsegmented') {
      headers = undefined;
    }

    const options: ProductFetchOptions = {
      variants: includeVariants,
      prices: includePrices ? priceOptions : false,
      categories: includeCategories,
    };
    if (ctx.mode === 'assigned') {
      options.segmentIds = ctx.segmentIds;
      // Membership is checked for the same site the mode/segments were resolved for.
      options.siteCode = ctx.siteCode ?? requestSite;
    }

    const searchService = server.get<SearchService>('SearchService');
    const product = await searchService.getCatalogProductById(productId, options);

    if (!product) {
      return NextResponse.json({ error: `Product with ID ${productId} not found` }, { status: 404, headers });
    }

    return NextResponse.json(product, { headers });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/products/${productId}`,
        method: 'GET',
        productId,
      },
      'Error fetching product',
    );
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500, headers });
  }
}
