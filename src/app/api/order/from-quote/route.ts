import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OrderService } from '@/platform/services/order/OrderService';

/**
 * POST /api/order/from-quote
 * Creates a new order from a quote
 */
export async function POST(request: NextRequest) {
  let quoteId: string | undefined;

  try {
    const body = await request.json();
    quoteId = body.quoteId;
    const { customerNote } = body;

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 });
    }

    const orderService = server.get<OrderService>('OrderService');
    const orderId = await orderService.createOrderFromQuote(quoteId, customerNote);

    return NextResponse.json({ orderId }, { status: 201 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/order/from-quote',
        method: 'POST',
        quoteId,
      },
      'Error creating order from quote',
    );
    const message = error instanceof Error ? error.message : 'Failed to create order from quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
