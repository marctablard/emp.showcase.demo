import { NextRequest, NextResponse } from 'next/server';
import { mapCartGetError } from '@/lib/common/cart-api-error-mapping';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart';
import { SessionService } from '@/platform/services/session';

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
    let cart: Cart | null = await cartService.getCart();

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
    return NextResponse.json(cart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const mappedError = mapCartGetError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cart',
        method: 'GET',
        ...mappedError.logContext,
      },
      'Error handling cart request',
    );
    return NextResponse.json(mappedError.response, { status: mappedError.status });
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
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cart',
        method: 'POST',
      },
      'Error creating cart',
    );
    return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 });
  }
}
