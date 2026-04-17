import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * PUT /api/session/currency
 * Update session currency
 */
export async function PUT(request: NextRequest) {
  try {
    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const data = await request.json();
    const currency = typeof data?.currency === 'string' ? data.currency.trim() : '';

    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
    }

    let updatedCart = await cartService.getCart();
    if (updatedCart && updatedCart.currency !== currency) {
      await cartService.updateCurrency(updatedCart.id, currency);
      updatedCart = (await cartService.getCartById(updatedCart.id)) ?? (await cartService.getCart());
    }

    const finalCurrency = updatedCart?.currency || currency;
    await sessionService.setCurrency(finalCurrency);

    return NextResponse.json({ success: true, currency: finalCurrency, cart: updatedCart ?? null });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/session/currency',
        method: 'PUT',
      },
      'Error updating session currency',
    );
    return NextResponse.json({ error: 'Failed to update session currency' }, { status: 500 });
  }
}
