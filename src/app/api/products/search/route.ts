import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductService } from '@/platform/services/product/ProductService';

/**
 * Search products by name using Emporix ProductService.
 * GET /api/products/search?query=term&locale=en&page=0&size=12
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query')?.trim();

  try {
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const page = url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!, 10) : 0;
    const size = url.searchParams.get('size') ? parseInt(url.searchParams.get('size')!, 10) : 12;
    const locale = url.searchParams.get('locale') || undefined;

    const productService = server.get<ProductService>('ProductService');
    const customerService = server.get<CustomerService>('CustomerService');

    let customerSegments = false;
    try {
      const customer = await customerService.getCustomer();
      customerSegments = Boolean(customer?.id);
    } catch {
      customerSegments = false;
    }

    const result = await productService.searchProductsByName(query, {
      page,
      pageSize: size,
      locale,
      prices: true,
      variants: false,
      categories: false,
      customerSegments,
    });

    return NextResponse.json(result);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/products/search',
        method: 'GET',
        query,
      },
      'Error searching products by name',
    );
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}
