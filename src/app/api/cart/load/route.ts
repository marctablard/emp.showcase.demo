import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * POST /api/cart/load
 * Load a saved cart
 */
export async function POST(request: NextRequest) {
  try {
    const cartService = server.get<CartService>('CartService');

    // Get request body with the cart ID to load
    const body = await request.json();
    const { cartId, type } = body;

    if (!cartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 });
    }

    // Load the saved cart
    await cartService.loadCart(cartId, type);

    // Get the current cart after loading
    const cart = await cartService.getCart();

    if (!cart) {
      return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 });
    }

    return NextResponse.json(cart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cart/load',
        method: 'POST',
      },
      'Error loading saved cart',
    );
    return NextResponse.json({ error: 'Failed to load saved cart' }, { status: 500 });
  }
}
