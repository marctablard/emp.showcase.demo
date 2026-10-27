import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { SubscriptionRequestError } from '@/platform/services/subscription/subscription-access';
import { SubscriptionPlanError } from '@/platform/services/subscription/subscription-rules';

export function subscriptionErrorResponse(error: unknown, path: string): NextResponse {
  if (error instanceof SubscriptionPlanError) {
    return NextResponse.json({ error: error.issue, issue: error.issue }, { status: 400 });
  }
  if (error instanceof SubscriptionRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const logger = server.get<LoggerService>('LoggerService');
  logger.error({ error: error instanceof Error ? error.message : String(error), path }, 'Subscription request failed');
  return NextResponse.json({ error: 'Failed to process subscription' }, { status: 500 });
}
