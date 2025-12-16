import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ProductService } from '@/platform/services/product/ProductService';

/**
 * API endpoint to get variants for a specific product by ID
 * GET /api/products/[id]/variants
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const productService = server.get<ProductService>('ProductService');

    const variants = await productService.getVariantProducts(productId);

    if (!variants || variants.length === 0) {
      return NextResponse.json({ variants: [] });
    }

    return NextResponse.json({ variants });
  } catch (error) {
    console.error('Error fetching product variants:', error);
    return NextResponse.json({ error: 'Failed to fetch product variants' }, { status: 500 });
  }
}
