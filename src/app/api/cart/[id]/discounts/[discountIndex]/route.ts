import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { mapCartDiscountRemoveError } from '@/lib/common/cart-api-error-mapping';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * DELETE /api/cart/[id]/discounts/[discountIndex]
 * Remove one discount from a cart by index. Anonymous sessions are allowed, mirroring the
 * apply route: a guest who could redeem an `allowAnonymous` coupon must be able to remove it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; discountIndex: string }> },
) {
  const resolvedParams = await params;
  const cartId = resolvedParams.id;
  const discountIndexParam = resolvedParams.discountIndex;

  try {
    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const discountIndex = Number(discountIndexParam);
    if (!Number.isFinite(discountIndex) || !Number.isInteger(discountIndex) || discountIndex < 0) {
      return NextResponse.json({ error: 'Discount index is required' }, { status: 400 });
    }

    const updatedCart = await cartService.removeDiscount(cartId, discountIndex);
    return NextResponse.json(updatedCart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const mappedError = mapCartDiscountRemoveError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/discounts/${discountIndexParam}`,
        method: 'DELETE',
        cartId,
        ...mappedError.logContext,
      },
      `Error removing cart discount for ${cartId}`,
    );
    return NextResponse.json(mappedError.response, { status: mappedError.status });
  }
}
