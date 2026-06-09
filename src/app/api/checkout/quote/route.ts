import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CheckoutService } from '@/platform/services/checkout/CheckoutService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteCheckoutRequest } from '@/platform/services/model/checkout';

/**
 * API route for processing a quote checkout
 * POST /api/checkout/quote
 */
export async function POST(request: NextRequest) {
  let quoteId: string | undefined;

  try {
    const checkoutService = server.get<CheckoutService>('CheckoutService');
    // Parse the request body
    const quoteCheckoutData: QuoteCheckoutRequest = await request.json();
    quoteId = quoteCheckoutData.quoteId;

    // Validate required fields
    if (!quoteCheckoutData.quoteId) {
      return NextResponse.json({ error: 'Missing required field: quoteId' }, { status: 400 });
    }

    if (!quoteCheckoutData.paymentMethod) {
      return NextResponse.json({ error: 'Missing required field: paymentMethod' }, { status: 400 });
    }

    // Process the quote checkout
    const response = await checkoutService.checkoutFromQuote(quoteCheckoutData);

    // Return the response
    return NextResponse.json(response);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/checkout/quote',
        method: 'POST',
        quoteId,
      },
      'Quote checkout error',
    );

    return NextResponse.json(
      { error: 'Failed to process quote checkout', details: (error as Error).message },
      { status: 500 },
    );
  }
}
