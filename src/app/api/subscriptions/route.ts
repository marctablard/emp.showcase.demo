import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { SubscriptionService } from '@/platform/services/subscription/SubscriptionService';
import { subscriptionErrorResponse } from './http';

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get('scope') ?? 'mine';
    if (scope !== 'mine' && scope !== 'company') {
      return NextResponse.json({ error: 'scope must be mine or company' }, { status: 400 });
    }
    const companyId = request.nextUrl.searchParams.get('companyId') ?? undefined;
    const subscriptions = server.get<SubscriptionService>('SubscriptionService');
    const items = await subscriptions.list(scope, companyId);
    return NextResponse.json(items);
  } catch (error) {
    return subscriptionErrorResponse(error, '/api/subscriptions');
  }
}
