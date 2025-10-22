import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CartService } from '@/platform/services/cart/CartService';

/**
 * Update shipping information for a cart
 * PATCH /api/cart/[id]/shipping
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cartId } = await params;

    // Get the cart service
    const cartService = server.get<CartService>('CartService');

    // Parse the request body
    const { countryCode, zipCode } = await request.json();

    // Update shipping info
    await cartService.updateShippingInfo(cartId, countryCode, zipCode);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating shipping info:', error);

    return NextResponse.json(
      { error: 'Failed to update shipping info', details: (error as Error).message },
      { status: 500 },
    );
  }
}
