import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductService } from '@/platform/services/product/ProductService';

/**
 * API endpoint to get variants for a specific product by ID
 * GET /api/products/[id]/variants
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;

  try {
    const productService = server.get<ProductService>('ProductService');

    const variants = await productService.getVariantProducts(productId);

    if (!variants || variants.length === 0) {
      return NextResponse.json({ variants: [] });
    }

    return NextResponse.json({ variants });
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
    return NextResponse.json({ error: 'Failed to fetch product variants' }, { status: 500 });
  }
}
