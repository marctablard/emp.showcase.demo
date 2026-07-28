import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { WishlistService } from '@/platform/services/wishlist';
import { logRouteError, requireAuthenticatedCustomer } from './_lib/route-helpers';

/**
 * GET /api/wishlist — returns the authenticated customer's wishlist, 204 when none exists,
 * 401 for anonymous users. There is no POST: wishlists are created lazily by adding the first
 * item via `/api/wishlist/items`.
 */
export async function GET() {
  const authError = await requireAuthenticatedCustomer();
  if (authError) return authError;

  try {
    const wishlistService = server.get<WishlistService>('WishlistService');
    const wishlist = await wishlistService.getDefaultWishlist();
    if (wishlist === null) {
      return new Response(null, { status: 204 });
    }
    return NextResponse.json(wishlist);
  } catch (error) {
    logRouteError(error, { path: '/api/wishlist', method: 'GET' }, 'Error fetching wishlist');
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
  }
}
