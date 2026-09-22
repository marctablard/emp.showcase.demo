import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { mapCartCurrencyPutError } from '@/lib/common/cart-api-error-mapping';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import { isCartCurrencyUpdateError } from '@/platform/services/cart/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { cartAddItemErrorResponse } from './cart-add-item-error';

/**
 * GET /api/carts/[id]/items
 * Get all items in a cart
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cartId = resolvedParams.id;

  try {
    const cartService = server.get<CartService>('CartService');
    const cart = await cartService.getCartById(cartId);

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json(cart.items);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/items`,
        method: 'GET',
        cartId,
      },
      `Error fetching cart items for ${cartId}`,
    );
    return NextResponse.json({ error: 'Failed to fetch cart items' }, { status: 500 });
  }
}

/**
 * POST /api/carts/[id]/items
 * Add an item to the cart
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cartId = resolvedParams.id;
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const cartService = server.get<CartService>('CartService');

    // Get request body
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || !quantity) {
      return NextResponse.json({ error: 'Product ID and quantity are required' }, { status: 400 });
    }

    // Add item to cart
    const result = await cartService.addItemToCart(cartId, productId, quantity);
    const effectiveCartId = result.cartId || cartId;

    // Session cart id may have moved when an empty, unusable cart was replaced.
    // A rejected current-cart lookup must not turn a successful add into a 500,
    // and must not fall back to the abandoned cart id.
    let updatedCart: Awaited<ReturnType<CartService['getCart']>> = null;
    try {
      updatedCart = await cartService.getCart();
    } catch (lookupError) {
      logger.warn(
        { err: lookupError, cartId, effectiveCartId },
        'Current cart lookup failed after add; using the cart that received the line',
      );
    }
    updatedCart ??= await cartService.getCartById(effectiveCartId);

    return NextResponse.json({
      ...result,
      cart: updatedCart,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/items`,
        method: 'POST',
        cartId,
      },
      `Error adding item to cart ${cartId}`,
    );

    if (isCartCurrencyUpdateError(error)) {
      const mappedError = mapCartCurrencyPutError(error);
      return NextResponse.json(mappedError.response, { status: mappedError.status });
    }

    return cartAddItemErrorResponse(errorMessage);
  }
}
