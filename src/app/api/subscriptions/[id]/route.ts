import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { SubscriptionService } from '@/platform/services/subscription/SubscriptionService';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const subscriptionService = server.get<SubscriptionService>('SubscriptionService');
    const subscription = await subscriptionService.getSubscription(id);
    if (!subscription) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const subscriptionService = server.get<SubscriptionService>('SubscriptionService');
    const body = await request.json();
    const saved = await subscriptionService.upsertSubscription({ ...body, id });
    return NextResponse.json(saved);
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const subscriptionService = server.get<SubscriptionService>('SubscriptionService');
    const body = await request.json();
    const action = body?.action as 'pause' | 'resume' | 'cancel' | undefined;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (action === 'pause') {
      await subscriptionService.pauseSubscription(id);
    } else if (action === 'resume') {
      await subscriptionService.resumeSubscription(id);
    } else if (action === 'cancel') {
      await subscriptionService.cancelSubscription(id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating subscription status:', error);
    return NextResponse.json({ error: 'Failed to update subscription status' }, { status: 500 });
  }
}
