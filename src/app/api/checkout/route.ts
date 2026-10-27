import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CheckoutService } from '@/platform/services/checkout/CheckoutService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CheckoutRequest, CheckoutResponse } from '@/platform/services/model/checkout';
import type { SubscriptionService } from '@/platform/services/subscription/SubscriptionService';
import { SubscriptionPlanError } from '@/platform/services/subscription/subscription-rules';

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
    const withSubscription = await attachSubscription(response, checkoutData);
    return NextResponse.json(withSubscription);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/checkout',
        method: 'POST',
        cartId: (error as any)?.checkoutData?.cartId,
      },
      'Checkout error',
    );

    return NextResponse.json(
      { error: 'Failed to process checkout', details: (error as Error).message },
      { status: 500 },
    );
  }
}

/** The order is already placed. A subscription failure is reported beside it and does not roll the order back. */
async function attachSubscription(
  response: CheckoutResponse,
  checkoutData: CheckoutRequest,
): Promise<CheckoutResponse> {
  if (!checkoutData.renewal || !response.orderId) return response;
  try {
    const subscriptions = server.get<SubscriptionService>('SubscriptionService');
    const created = await subscriptions.createForOrder(response.orderId, checkoutData.renewal);
    return { ...response, subscriptionId: created.id };
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const issue = error instanceof SubscriptionPlanError ? error.issue : 'failed';
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      { orderId: response.orderId, issue, error: message },
      'Order was placed but the subscription was not created',
    );
    return { ...response, subscriptionIssue: issue };
  }
}
