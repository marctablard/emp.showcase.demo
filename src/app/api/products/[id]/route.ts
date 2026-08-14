import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { PriceFetchOptions } from '@/platform/services/price/PriceService';
import type { SearchService } from '@/platform/services/search/SearchService';

/**
 * API endpoint to get a specific product by ID
 * GET /api/products/[id]?variants=true&prices=true&categories=true
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

  try {
    const searchService = server.get<SearchService>('SearchService');
    const product = await searchService.getCatalogProductById(productId, {
      variants: includeVariants,
      prices: includePrices ? priceOptions : false,
      categories: includeCategories,
    });

    if (!product) {
      return NextResponse.json({ error: `Product with ID ${productId} not found` }, { status: 404 });
    }

    return NextResponse.json(product);
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
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
