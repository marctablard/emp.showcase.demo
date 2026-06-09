import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OrderService } from '@/platform/services/order/OrderService';

/**
 * POST /api/orders/[id]/transition
 * Apply a customer-managed order status transition (allowlisted body).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const orderId = resolvedParams.id;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const status =
      body && typeof body === 'object' && 'status' in body ? (body as { status: unknown }).status : undefined;

    if (status !== 'DECLINED') {
      return NextResponse.json({ error: 'Invalid or unsupported transition status' }, { status: 400 });
    }

    const orderService = server.get<OrderService>('OrderService');
    await orderService.applyCustomerOrderTransition(orderId, status);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/orders/${orderId}/transition`,
        method: 'POST',
        orderId,
      },
      `Error applying customer order transition for order ${orderId}`,
    );
    const message = error instanceof Error ? error.message : 'Failed to apply order transition';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
