import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { WishlistService } from '@/platform/services/wishlist';
import { isWishlistNotFoundError, logRouteError, requireAuthenticatedCustomer } from '../../_lib/route-helpers';

type RouteParams = { params: Promise<{ productId: string }> };

/**
 * PATCH /api/wishlist/items/[productId] — update line quantity.
 * Body: { quantity: integer >= 1 }. ProductId is the natural key (one line per product).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authError = await requireAuthenticatedCustomer();
  if (authError) return authError;

  const { productId } = await params;
  const body = await request.json().catch(() => ({}));
  if (!Number.isInteger(body.quantity) || body.quantity < 1) {
    return NextResponse.json({ error: 'Valid quantity (integer >= 1) is required' }, { status: 400 });
  }

  try {
    const wishlistService = server.get<WishlistService>('WishlistService');
    const wishlist = await wishlistService.updateItemQuantity(productId, body.quantity);
    return NextResponse.json(wishlist);
  } catch (error) {
    if (isWishlistNotFoundError(error)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logRouteError(
      error,
      { path: `/api/wishlist/items/${productId}`, method: 'PATCH', productId },
      'Error updating wishlist item quantity',
    );
    return NextResponse.json({ error: 'Failed to update wishlist item' }, { status: 500 });
  }
}

/**
 * DELETE /api/wishlist/items/[productId] — remove the line. 204 when the removal emptied the
 * wishlist (auto-deleted), 200 with the remaining items otherwise.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const authError = await requireAuthenticatedCustomer();
  if (authError) return authError;

  const { productId } = await params;

  try {
    const wishlistService = server.get<WishlistService>('WishlistService');
    const wishlist = await wishlistService.removeItem(productId);
    if (wishlist === null) {
      return new Response(null, { status: 204 });
    }
    return NextResponse.json(wishlist);
  } catch (error) {
    if (isWishlistNotFoundError(error)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logRouteError(
      error,
      { path: `/api/wishlist/items/${productId}`, method: 'DELETE', productId },
      'Error removing wishlist item',
    );
    return NextResponse.json({ error: 'Failed to remove wishlist item' }, { status: 500 });
  }
}
