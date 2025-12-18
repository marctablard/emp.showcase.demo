import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ProductService } from '@/platform/services/product/ProductService';

/**
 * API endpoint to get a list of all products
 * GET /api/products?size=10000
 * Uses ProductService to get all products
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const size = searchParams.get('size') ? parseInt(searchParams.get('size')!) : 10000;

    const productService = server.get<ProductService>('ProductService');

    // Fetch products in batches
    let allProducts: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore && allProducts.length < size) {
      const result = await productService.getProducts(page, pageSize);

      // Filter to purchasable products
      const purchasable = result.items.filter((product: any) => product.purchasable);
      allProducts = [...allProducts, ...purchasable];

      // Check if we have more pages
      const totalFetched = (page + 1) * pageSize;
      hasMore = result.items.length === pageSize && totalFetched < result.total && allProducts.length < size;
      page++;

      // Safety limit
      if (page > 100) break;
    }

    console.log(`Fetched ${allProducts.length} products from ProductService`);

    return NextResponse.json({
      items: allProducts.slice(0, size),
      page: 0,
      pageSize: allProducts.length,
      total: allProducts.length,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
