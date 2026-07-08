import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { StockService } from '@/platform/services/stock/StockService';

/**
 * Batch availability lookup for multiple products on the current session site.
 * POST /api/products/availability/batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { productIds?: string[] };
    const productIds = body.productIds?.filter(Boolean) ?? [];

    if (productIds.length === 0) {
      return NextResponse.json({ availabilities: {} });
    }

    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const stockService = server.get<StockService>('StockService');
    const availabilities = await stockService.getStockAvailabilities(session.siteCode, productIds);

    return NextResponse.json({ availabilities });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/products/availability/batch',
        method: 'POST',
      },
      'Error fetching batch product availability',
    );
    return NextResponse.json({ error: 'Failed to fetch product availability' }, { status: 500 });
  }
}
