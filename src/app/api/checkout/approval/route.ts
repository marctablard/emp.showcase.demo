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

    // Process the checkout
    const response = await checkoutService.checkoutApproval(checkoutData);
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
