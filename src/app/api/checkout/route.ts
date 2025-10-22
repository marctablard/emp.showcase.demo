import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CheckoutService } from '@/platform/services/checkout/CheckoutService';
import type { CheckoutRequest } from '@/platform/services/model/checkout';

/**
 * API route for processing a cart checkout
 * POST /api/checkout
 */
export async function POST(request: NextRequest) {
  try {
    const checkoutService = server.get<CheckoutService>('CheckoutService');
    // Parse the request body
    const checkoutData: CheckoutRequest = await request.json();

    // Validate required fields
    if (!checkoutData.cartId) {
      return NextResponse.json({ error: 'Missing required field: cartId' }, { status: 400 });
    }

    if (!checkoutData.addresses || checkoutData.addresses.length < 2) {
      return NextResponse.json({ error: 'Both shipping and billing addresses are required' }, { status: 400 });
    }

    if (!checkoutData.shipping) {
      return NextResponse.json({ error: 'Missing required field: shipping' }, { status: 400 });
    }

    if (!checkoutData.paymentMethod) {
      return NextResponse.json({ error: 'Missing required field: paymentMethod' }, { status: 400 });
    }

    // Process the checkout
    const response = await checkoutService.checkout(checkoutData);
    const nextResponse = NextResponse.json(response);
    // Return the response
    return nextResponse;
  } catch (error) {
    console.error('Checkout error:', error);

    return NextResponse.json(
      { error: 'Failed to process checkout', details: (error as Error).message },
      { status: 500 },
    );
  }
}
