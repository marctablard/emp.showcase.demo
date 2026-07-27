import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { WishlistService } from '@/platform/services/wishlist';
import { logRouteError, requireAuthenticatedCustomer } from '../_lib/route-helpers';

/**
 * POST /api/wishlist/items — adds a product to the customer's wishlist (lazy-creates it on
 * first add). Body: { productId: string, quantity: integer >= 1 }.
 */
export async function POST(request: NextRequest) {
  const authError = await requireAuthenticatedCustomer();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });
  }
  if (!Number.isInteger(body.quantity) || body.quantity < 1) {
    return NextResponse.json({ error: 'Valid quantity (integer >= 1) is required' }, { status: 400 });
  }

  try {
    const wishlistService = server.get<WishlistService>('WishlistService');
    const wishlist = await wishlistService.addItem(productId, body.quantity);
    return NextResponse.json(wishlist);
  } catch (error) {
    logRouteError(error, { path: '/api/wishlist/items', method: 'POST' }, 'Error adding item to wishlist');
    return NextResponse.json({ error: 'Failed to add item to wishlist' }, { status: 500 });
  }
}
