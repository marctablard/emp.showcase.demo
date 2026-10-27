import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { SubscriptionService } from '@/platform/services/subscription/SubscriptionService';
import { subscriptionErrorResponse } from '../http';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { orderIds?: unknown };
    const orderIds = Array.isArray(body.orderIds)
      ? body.orderIds.filter((id): id is string => typeof id === 'string')
      : [];
    const subscriptions = server.get<SubscriptionService>('SubscriptionService');
    const links = await subscriptions.orderLinks(orderIds);
    return NextResponse.json({ links });
  } catch (error) {
    return subscriptionErrorResponse(error, '/api/subscriptions/order-links');
  }
}
