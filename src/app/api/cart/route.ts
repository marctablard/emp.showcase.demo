import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart';
import type { Cart } from '@/platform/services/model/cart';
import { SessionService } from '@/platform/services/session';

export const revalidate = 0;
/**
 * GET /api/carts
 * Get the current cart or create a new one if none exists
 * @param {Object} params - Request parameters
 * @param {boolean} [params.create=true] - Whether to create a new cart if one doesn't exist
 */
export async function GET(request: NextRequest) {
  try {
    // Parse URL to check for 'create' parameter
    const { searchParams } = new URL(request.url);
    const create = searchParams.get('create') === 'true'; // Default to false if not specified

    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return new Response(null, {
        status: 204,
      });
    }
    // Check for cart ID in cookies
    let cart: Cart | null | undefined;

    try {
      cart = await cartService.getCart();
    } catch (_error) {
      cart = undefined;
    }

    // If we don't have a cart and shouldCreate is false, return 204 (intentionally empty)
    if (!cart && create) {
      // Create a new cart
      const newCartId = await cartService.createCart(session.currency, session.siteCode);
      if (!newCartId) {
        return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 });
      }
      cart = await cartService.getCartById(newCartId);
    }
    // null found for cart
    if (cart === null) {
      return new Response(null, { status: 204 });
    }
    // undefined, so it's an Error
    if (cart === undefined) {
      return NextResponse.json({ error: 'Failed to find Cart' }, { status: 404 });
    }

    return NextResponse.json(cart);
  } catch (error) {
    console.error('Error handling cart request:', error);
    return NextResponse.json({ error: 'Failed to process cart request' }, { status: 500 });
  }
}

/**
 * POST /api/carts
 * Create a new cart
 */
export async function POST(request: NextRequest) {
  try {
    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Failed to get session context' }, { status: 500 });
    }
    // Get request body
    const body = await request.json();
    const currency = body.currency || session.currency;
    const siteCode = body.siteCode || session.siteCode;

    // Create a new cart
    const cartId = await cartService.createCart(currency, siteCode);
    const cart = await cartService.getCartById(cartId);

    return NextResponse.json(cart);
  } catch (error) {
    console.error('Error creating cart:', error);
    return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 });
  }
}
