import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * GET /api/carts/saved
 * Get all saved carts for the current customer
 */
export async function GET(request: NextRequest) {
  // Get query parameters for pagination (outside try for logging context)
  const searchParams = request.nextUrl.searchParams;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 10;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 0;

  try {
    const cartService = server.get<CartService>('CartService');

    const savedCarts = await cartService.getSavedCarts({ page, size: pageSize });

    return NextResponse.json(savedCarts);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/carts/saved',
        method: 'GET',
        page,
        pageSize,
      },
      'Error fetching saved carts',
    );
    return NextResponse.json({ error: 'Failed to fetch saved carts' }, { status: 500 });
  }
}
