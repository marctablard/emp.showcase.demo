import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { PriceService } from '@/platform/services/price/PriceService';
import type { SessionService } from '@/platform/services/session/SessionService';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { productIds, currency: currencyOverride } = body as { productIds?: unknown; currency?: unknown };

  if (!Array.isArray(productIds) || productIds.length === 0 || !productIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'productIds must be a non-empty array of strings' }, { status: 400 });
  }

  if (productIds.length > 100) {
    return NextResponse.json({ error: 'Too many productIds (max 100)' }, { status: 400 });
  }

  try {
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Use client-provided currency if available to avoid race condition
    // between client-side session store and server-side session context propagation
    const currency = (typeof currencyOverride === 'string' && currencyOverride) || session.currency;

    const priceService = server.get<PriceService>('PriceService');
    const priceMap = await priceService.getProductPrices(productIds as string[], undefined, undefined, {
      siteCode: session.siteCode,
      currency,
      country: session.country,
    });

    const result: Record<string, unknown> = {};
    for (const [id, price] of priceMap) {
      result[id] = price;
    }

    return NextResponse.json(result);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/products/prices',
        method: 'POST',
        productIds,
      },
      'Error fetching batch product prices',
    );
    return NextResponse.json({ error: 'Failed to fetch product prices' }, { status: 500 });
  }
}
