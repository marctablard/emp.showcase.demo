import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { mapCartCurrencyPutError } from '@/lib/common/cart-api-error-mapping';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * PUT /api/cart/[id]/currency
 * Update the currency for a cart
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cartId = resolvedParams.id;

  try {
    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const body = await request.json();
    const currency = typeof body?.currency === 'string' ? body.currency.trim() : '';

    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
    }

    await cartService.updateCurrency(cartId, currency);
    const updatedCart = (await cartService.getCartById(cartId)) ?? (await cartService.getCart());

    if (!updatedCart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (session.currency !== updatedCart.currency) {
      await sessionService.setCurrency(updatedCart.currency);
    }

    return NextResponse.json(updatedCart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const mappedError = mapCartCurrencyPutError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/currency`,
        method: 'PUT',
        cartId,
        ...mappedError.logContext,
      },
      `Error updating cart currency for ${cartId}`,
    );
    return NextResponse.json(mappedError.response, { status: mappedError.status });
  }
}
