import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { SearchService } from '@/platform/services/search/SearchService';

/**
 * API endpoint to get product recommendations based on a product ID
 * GET /api/search/recommendations/[id]?size=12
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const url = new URL(request.url);
  const sizeRaw = url.searchParams.get('size');
  const locale = url.searchParams.get('locale') || undefined;
  const parsedSize = sizeRaw ? parseInt(sizeRaw, 10) : NaN;
  const limit = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 12;

  try {
    const searchService = server.get<SearchService>('SearchService');
    const productService = server.get<ProductService>('ProductService');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const recommendations = await searchService.getRecommendations(productId, locale, undefined, limit);

    const [products, crossSell, upSell] = await Promise.all([
      productService.addAdditionalData(recommendations.products ?? [], { prices: true }),
      productService.addAdditionalData(recommendations.crossSell ?? [], { prices: true }),
      productService.addAdditionalData(recommendations.upSell ?? [], { prices: true }),
    ]);

    return NextResponse.json({ products, crossSell, upSell });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/search/recommendations/${productId}`,
        method: 'GET',
        productId,
      },
      'Error fetching product recommendations',
    );
    return NextResponse.json({ error: 'Failed to fetch product recommendations' }, { status: 500 });
  }
}
