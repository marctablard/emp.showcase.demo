import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { SubscriptionService } from '@/platform/services/subscription/SubscriptionService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const subscriptionService = server.get<SubscriptionService>('SubscriptionService');
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 0;
    const size = searchParams.get('size') ? parseInt(searchParams.get('size')!, 10) : 10;

    const result = await subscriptionService.getSubscriptionsForCurrentCustomer({ page, size });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const subscriptionService = server.get<SubscriptionService>('SubscriptionService');
    const body = await request.json();
    const saved = await subscriptionService.upsertSubscription(body);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('Error creating subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create subscription';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error('Error details:', errorDetails);
    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      },
      { status: 500 },
    );
  }
}
