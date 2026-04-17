import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Update shipping information for a cart
 * PATCH /api/cart/[id]/shipping
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cartId } = await params;

  try {
    // Get the cart service
    const cartService = server.get<CartService>('CartService');

    const { shippingAddress, billingAddress } = await request.json();

    await cartService.updateShippingInfo(cartId, shippingAddress, billingAddress);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/cart/${cartId}/shipping`,
        method: 'PATCH',
        cartId,
      },
      'Error updating shipping info',
    );

    return NextResponse.json(
      { error: 'Failed to update shipping info', details: (error as Error).message },
      { status: 500 },
    );
  }
}
