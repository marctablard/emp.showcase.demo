import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ProductService } from '@/platform/services/product/ProductService';

/**
 * API endpoint to get a specific product by ID
 * GET /api/products/[id]?variants=true&prices=true&categories=true
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const includeVariants = searchParams.get('variants') === 'true';
    const includePrices = searchParams.get('prices') === 'true';
    const includeCategories = searchParams.get('categories') === 'true';

    const productService = server.get<ProductService>('ProductService');
    const product = await productService.getProductById(productId, {
      variants: includeVariants,
      prices: includePrices,
      categories: includeCategories,
    });

    if (!product) {
      return NextResponse.json({ error: `Product with ID ${productId} not found` }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
