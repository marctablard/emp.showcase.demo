import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { OrderService } from '@/platform/services/order/OrderService';

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
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
