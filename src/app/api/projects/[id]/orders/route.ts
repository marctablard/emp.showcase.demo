import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { EmporixOrder } from '@/platform/integrations/emporix/model/order';
import type { EmporixOrderApi } from '@/platform/integrations/emporix/order/EmporixOrderApi';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OrderMapper } from '@/platform/services/model/order/OrderMapper';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const orderApi = server.get<EmporixOrderApi>('EmporixOrderApi');
    const mapper = server.get<OrderMapper<EmporixOrder>>('EmporixOrderMapper');
    // Filter orders where the project mixin matches
    const rawOrders = await orderApi.getCustomerOrders(100, 1, undefined, `mixins.project.projectid:${projectId}`);
    const orders = rawOrders.map((o) => mapper.mapToService(o));
    return NextResponse.json(orders);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching project orders');
    return NextResponse.json({ error: 'Failed to fetch project orders' }, { status: 500 });
  }
}
