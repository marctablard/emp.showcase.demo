import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { mapPromoCodeError } from '@/lib/common/cart-api-error-mapping';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Manage promo/coupon codes on a cart
 * POST /api/cart/[id]/discounts — apply a code
 * DELETE /api/cart/[id]/discounts?codes=CODE — remove a code
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cartId } = await params;

  try {
    const cartService = server.get<CartService>('CartService');
    const body = await request.json();
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    const updatedCart = await cartService.applyPromoCode(cartId, code);
    return NextResponse.json(updatedCart, { status: 200 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const mappedError = mapPromoCodeError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/discounts`,
        method: 'POST',
        cartId,
        ...mappedError.logContext,
      },
      'Error applying promo code',
    );

    return NextResponse.json(mappedError.response, { status: mappedError.status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cartId } = await params;

  try {
    const cartService = server.get<CartService>('CartService');
    const codesParam = request.nextUrl.searchParams.get('codes')?.trim();
    const code = codesParam?.split(',')[0]?.trim() ?? '';

    const updatedCart = await cartService.removePromoCode(cartId, code);
    return NextResponse.json(updatedCart, { status: 200 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const mappedError = mapPromoCodeError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/discounts`,
        method: 'DELETE',
        cartId,
        ...mappedError.logContext,
      },
      'Error removing promo code',
    );

    return NextResponse.json(mappedError.response, { status: mappedError.status });
  }
}
