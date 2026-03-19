import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Return, ReturnItem } from '@/platform/services/model/return';
import type { OrderService } from '@/platform/services/order/OrderService';
import { ReturnService } from '@/platform/services/return/ReturnService';

export const revalidate = 0;

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Enriches return items with product metadata (images, productId, brand)
 * sourced from the original order.
 */
async function enrichReturnWithOrderData(returnData: Return): Promise<Return> {
  const orderIds = returnData.orders.map((o) => o.id);
  if (orderIds.length === 0) return returnData;

  try {
    const orderService = server.get<OrderService>('OrderService');
    const orders = await Promise.all(orderIds.map((id) => orderService.getCustomerOrderById(id)));

    const orderItemMap = new Map<string, { productId: string; images?: string[]; brand?: string; sku?: string }>();
    for (const order of orders) {
      if (!order) continue;
      for (const item of order.items) {
        orderItemMap.set(`${order.id}:${item.id}`, {
          productId: item.productId,
          images: item.images,
          brand: undefined,
          sku: item.sku,
        });
      }
    }

    const enrichedOrders = returnData.orders.map((returnOrder) => ({
      ...returnOrder,
      items: returnOrder.items.map((item): ReturnItem => {
        const orderItem = orderItemMap.get(`${returnOrder.id}:${item.id}`);
        if (!orderItem) return item;
        return {
          ...item,
          productId: item.productId ?? orderItem.productId,
          images: item.images ?? orderItem.images,
          brand: item.brand ?? orderItem.brand,
          itemNumber: item.itemNumber ?? orderItem.sku,
        };
      }),
    }));

    return { ...returnData, orders: enrichedOrders };
  } catch {
    return returnData;
  }
}

/**
 * GET /api/returns/[id]
 * Get a specific return by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const returnService = server.get<ReturnService>('ReturnService');
    const returnItem = await returnService.getReturn(id);

    if (!returnItem) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    const enriched = await enrichReturnWithOrderData(returnItem);
    return NextResponse.json(enriched);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/returns/${id}`,
        method: 'GET',
        returnId: id,
      },
      `Error fetching return ${id}`,
    );
    return NextResponse.json({ error: 'Failed to fetch return' }, { status: 500 });
  }
}
