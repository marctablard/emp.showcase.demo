import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { SubscriptionService } from '@/platform/services/subscription/SubscriptionService';
import { type SubscriptionItem, isSubscriptionInterval } from '@/platform/services/subscription/subscription-rules';
import { subscriptionErrorResponse } from '../http';

type PlanBody = {
  lines?: { productId?: string; quantity?: number }[];
  every?: number;
  unit?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlanBody;
    if (!Array.isArray(body.lines)) {
      return NextResponse.json({ error: 'lines are required' }, { status: 400 });
    }
    const lines: SubscriptionItem[] = [];
    for (const line of body.lines) {
      const productId = typeof line.productId === 'string' ? line.productId.trim() : '';
      const quantity = line.quantity;
      if (!productId || typeof quantity !== 'number' || quantity < 1) continue;
      lines.push({ productId, quantity: Math.floor(quantity) });
    }
    const chosen =
      typeof body.every === 'number' && isSubscriptionInterval(body.unit)
        ? { every: body.every, unit: body.unit }
        : undefined;
    const subscriptions = server.get<SubscriptionService>('SubscriptionService');
    return NextResponse.json(await subscriptions.plan(lines, chosen));
  } catch (error) {
    return subscriptionErrorResponse(error, '/api/subscriptions/plan');
  }
}
