import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * GET /api/carts/[id]
 * Get a specific cart by ID
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

    return NextResponse.json(cart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}`,
        method: 'GET',
        cartId,
      },
      `Error fetching cart ${cartId}`,
    );
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}

/**
 * DELETE /api/carts/[id]
 * Delete a cart
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cartId = resolvedParams.id;
  try {
    const cartService = server.get<CartService>('CartService');

    await cartService.deleteCart(cartId);

    // Best-effort: also clear the session's currentCart reference
    // so it doesn't point to a deleted cart.
    try {
      const sessionService = server.get<SessionService>('SessionService');
      await sessionService.clearCart();
    } catch (clearError) {
      const logger = server.get<LoggerService>('LoggerService');
      logger.warn(
        { error: clearError instanceof Error ? clearError.message : String(clearError), cartId },
        'Failed to clear session cart reference after cart deletion',
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}`,
        method: 'DELETE',
        cartId,
      },
      `Error deleting cart ${cartId}`,
    );
    return NextResponse.json({ error: 'Failed to delete cart' }, { status: 500 });
  }
}
