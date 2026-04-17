import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OrderService } from '@/platform/services/order/OrderService';

/**
 * GET /api/orders
 * Get all orders for the current customer
 */
export async function GET(request: NextRequest) {
  try {
    const orderService = server.get<OrderService>('OrderService');

    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined;
    const pageNumber = searchParams.get('pageNumber') ? parseInt(searchParams.get('pageNumber')!) : undefined;

    const orders = await orderService.getCustomerOrders(pageSize, pageNumber);

    return NextResponse.json(orders);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/orders',
        method: 'GET',
      },
      'Error fetching orders',
    );
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
