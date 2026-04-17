import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OrderService } from '@/platform/services/order/OrderService';

/**
 * GET /api/orders/[id]
 * Get a specific order by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const orderId = resolvedParams.id;

  try {
    const orderService = server.get<OrderService>('OrderService');

    const order = await orderService.getCustomerOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/orders/${orderId}`,
        method: 'GET',
        orderId,
      },
      `Error fetching order ${orderId}`,
    );
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}
