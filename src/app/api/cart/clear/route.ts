import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * POST /api/cart/clear
 * Clears the cart reference from the server-side session context.
 * Optionally also deletes the cart entity if ?delete=true is passed.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const logger = server.get<LoggerService>('LoggerService');

    const session = await sessionService.getCurrent();
    const cartId = session?.cartId;

    await sessionService.clearCart();

    // Optionally delete the cart entity
    const shouldDelete = request.nextUrl.searchParams.get('delete') === 'true';
    if (shouldDelete && cartId) {
      try {
        const cartService = server.get<CartService>('CartService');
        await cartService.deleteCart(cartId);
      } catch (deleteError) {
        // Log but don't fail — session is already cleared
        logger.warn(
          { error: deleteError instanceof Error ? deleteError.message : String(deleteError), cartId },
          'Failed to delete cart entity during cart clear',
        );
      }
    }

    return NextResponse.json({ success: true, clearedCartId: cartId || null });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error clearing cart');
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 });
  }
}
