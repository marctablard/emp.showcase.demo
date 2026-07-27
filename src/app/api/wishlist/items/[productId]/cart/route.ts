import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { WishlistService } from '@/platform/services/wishlist';
import { isWishlistNotFoundError, logRouteError, requireAuthenticatedCustomer } from '../../../_lib/route-helpers';

type RouteParams = { params: Promise<{ productId: string }> };

/**
 * POST /api/wishlist/items/[productId]/cart — move a line to the shopping cart.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const authError = await requireAuthenticatedCustomer();
  if (authError) return authError;

  const { productId } = await params;

  try {
    const wishlistService = server.get<WishlistService>('WishlistService');
    const result = await wishlistService.moveItemToCart(productId);
    return NextResponse.json(result);
  } catch (error) {
    if (isWishlistNotFoundError(error)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logRouteError(
      error,
      { path: `/api/wishlist/items/${productId}/cart`, method: 'POST', productId },
      'Error moving wishlist item to cart',
    );
    return NextResponse.json({ error: 'Failed to move wishlist item to cart' }, { status: 500 });
  }
}
