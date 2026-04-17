import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CheckoutService } from '@/platform/services/checkout/CheckoutService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CheckoutRequest } from '@/platform/services/model/checkout';

/**
 * API route for processing a cart checkout
 * POST /api/checkout
 */
export async function POST(request: NextRequest) {
  let cartId: string | undefined;

  try {
    const checkoutService = server.get<CheckoutService>('CheckoutService');
    // Parse the request body
    const checkoutData: CheckoutRequest = await request.json();
    cartId = checkoutData.cartId;

    // Process the checkout
    const response = await checkoutService.checkoutApproval(checkoutData);
    const nextResponse = NextResponse.json(response);
    // Return the response
    return nextResponse;
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/checkout/approval',
        method: 'POST',
        cartId,
      },
      'Checkout error',
    );

    return NextResponse.json(
      { error: 'Failed to process checkout', details: (error as Error).message },
      { status: 500 },
    );
  }
}
