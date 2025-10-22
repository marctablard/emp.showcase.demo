import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart/CartService';

/**
 * GET /api/carts/saved
 * Get all saved carts for the current customer
 */
export async function GET(request: NextRequest) {
  try {
    const cartService = server.get<CartService>('CartService');

    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 10;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 0;

    const savedCarts = await cartService.getSavedCarts({ page, size: pageSize });

    return NextResponse.json(savedCarts);
  } catch (error) {
    console.error('Error fetching saved carts:', error);
    return NextResponse.json({ error: 'Failed to fetch saved carts' }, { status: 500 });
  }
}
