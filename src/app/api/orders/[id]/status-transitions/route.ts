import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { OrderService } from '@/platform/services/order/OrderService';

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
    console.error(`Error fetching status transitions for order ${orderId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch status transitions' }, { status: 500 });
  }
}
