import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OrderService } from '@/platform/services/order/OrderService';

/**
 * GET /api/orders/[id]/status-transitions
 * Get available status transitions for a specific order
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const orderId = resolvedParams.id;

  try {
    const orderService = server.get<OrderService>('OrderService');

    const statusTransitions = await orderService.getCustomerOrderStatusTransitions(orderId);

    return NextResponse.json(statusTransitions);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/orders/${orderId}/status-transitions`,
        method: 'GET',
        orderId,
      },
      `Error fetching status transitions for order ${orderId}`,
    );
    return NextResponse.json({ error: 'Failed to fetch status transitions' }, { status: 500 });
  }
}
