import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { OrderService } from '@/platform/services/order/OrderService';

/**
 * POST /api/order/from-quote
 * Creates a new order from a quote
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId, customerNote } = body;

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 });
    }

    const orderService = server.get<OrderService>('OrderService');
    const orderId = await orderService.createOrderFromQuote(quoteId, customerNote);

    return NextResponse.json({ orderId }, { status: 201 });
  } catch (error) {
    console.error('Error creating order from quote:', error);
    const message = error instanceof Error ? error.message : 'Failed to create order from quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
