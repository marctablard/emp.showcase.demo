import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { CartErrorCode } from '@/platform/services/model/cart/error-codes';

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

    // Get updated cart
    const updatedCart = await cartService.getCartById(cartId);

    return NextResponse.json({
      ...result,
      cart: updatedCart,
    });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
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

    // Detect Emporix price/tax validation error and return structured 400
    if (errorMessage.includes('PriceIds') && errorMessage.includes('invalid')) {
      return NextResponse.json(
        {
          error: 'Product price is not available for this site',
          code: CartErrorCode.PRICE_SITE_INCOMPATIBLE,
          details: errorMessage,
        },
        { status: 400 },
      );
    }

    // Generic site-specific price unavailability
    if (errorMessage.includes('price is not available') || errorMessage.includes('not available for this site')) {
      return NextResponse.json(
        {
          error: "This product's price is not available for the current site.",
          code: CartErrorCode.PRICE_NOT_AVAILABLE,
          details: errorMessage,
        },
        { status: 400 },
      );
    }

    // Cart-site mismatch from Emporix
    if (
      errorMessage.includes('siteCode') &&
      (errorMessage.includes('mismatch') || errorMessage.includes('does not match'))
    ) {
      return NextResponse.json(
        {
          error: 'Your cart belongs to a different site. Please refresh the page.',
          code: CartErrorCode.CART_SITE_MISMATCH,
          details: errorMessage,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 });
  }
}
