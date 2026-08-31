import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Persist the selected shipping method on the cart (delivery window → recalculated totals).
 * PATCH /api/cart/[id]/shipping-method
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cartId } = await params;

  try {
    const cartService = server.get<CartService>('CartService');
    const { methodId, zoneId, methodName } = await request.json();

    if (!methodId || typeof methodId !== 'string') {
      return NextResponse.json({ error: 'Missing required parameter: methodId' }, { status: 400 });
    }
    if (!zoneId || typeof zoneId !== 'string') {
      return NextResponse.json({ error: 'Missing required parameter: zoneId' }, { status: 400 });
    }

    const cart = await cartService.updateShippingMethod(cartId, {
      methodId,
      zoneId,
      methodName: typeof methodName === 'string' ? methodName : undefined,
    });

    return NextResponse.json(cart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/shipping-method`,
        method: 'PATCH',
        cartId,
      },
      'Error updating shipping method',
    );

    return NextResponse.json(
      { error: 'Failed to update shipping method', details: (error as Error).message },
      { status: 500 },
    );
  }
}
