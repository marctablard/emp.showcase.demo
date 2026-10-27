import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { SubscriptionService } from '@/platform/services/subscription/SubscriptionService';
import { type SubscriptionItem, isSubscriptionInterval } from '@/platform/services/subscription/subscription-rules';
import { subscriptionErrorResponse } from '../http';

type PatchBody = {
  action?: string;
  every?: number;
  unit?: string;
  items?: { productId?: string; quantity?: number }[];
};

function itemsOf(body: PatchBody): SubscriptionItem[] | null {
  if (!Array.isArray(body.items) || body.items.length === 0) return null;
  const items: SubscriptionItem[] = [];
  for (const item of body.items) {
    const productId = typeof item.productId === 'string' ? item.productId.trim() : '';
    const quantity = item.quantity;
    if (!productId || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return null;
    items.push({ productId, quantity });
  }
  return items;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const subscriptions = server.get<SubscriptionService>('SubscriptionService');
    return NextResponse.json(await subscriptions.get(id));
  } catch (error) {
    return subscriptionErrorResponse(error, '/api/subscriptions/[id]');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    const subscriptions = server.get<SubscriptionService>('SubscriptionService');
    if (body.action === 'pause') return NextResponse.json(await subscriptions.pause(id));
    if (body.action === 'resume') return NextResponse.json(await subscriptions.resume(id));
    if (body.action === 'cancel') return NextResponse.json(await subscriptions.cancel(id));
    if (body.action === 'cadence') {
      if (typeof body.every !== 'number' || !isSubscriptionInterval(body.unit)) {
        return NextResponse.json({ error: 'every and unit are required' }, { status: 400 });
      }
      return NextResponse.json(await subscriptions.setCadence(id, body.every, body.unit));
    }
    if (body.action === 'items') {
      const items = itemsOf(body);
      if (!items) return NextResponse.json({ error: 'A subscription needs at least one product.' }, { status: 400 });
      return NextResponse.json(await subscriptions.setItems(id, items));
    }
    return NextResponse.json({ error: 'Unknown subscription action' }, { status: 400 });
  } catch (error) {
    return subscriptionErrorResponse(error, '/api/subscriptions/[id]');
  }
}
