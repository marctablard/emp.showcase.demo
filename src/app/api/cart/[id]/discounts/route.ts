import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { mapCartDiscountApplyError } from '@/lib/common/cart-api-error-mapping';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

const COUPON_CODE_MAX_LENGTH = 150;

/**
 * POST /api/cart/[id]/discounts
 * Apply a discount coupon to a cart
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (code.length > COUPON_CODE_MAX_LENGTH) {
      return NextResponse.json({ error: 'Code exceeds maximum length' }, { status: 400 });
    }

    const updatedCart = await cartService.applyDiscount(cartId, code);
    return NextResponse.json(updatedCart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const mappedError = mapCartDiscountApplyError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/discounts`,
        method: 'POST',
        cartId,
        ...mappedError.logContext,
      },
      `Error applying cart discount for ${cartId}`,
    );
    return NextResponse.json(mappedError.response, { status: mappedError.status });
  }
}
