import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { StockService } from '@/platform/services/stock/StockService';

/**
 * API endpoint to get availability for a specific product by ID
 * GET /api/products/[id]/availability
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;

  try {
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const stockService = server.get<StockService>('StockService');
    const availability = await stockService.getStockAvailability(session.siteCode, productId);

    if (!availability) {
      return NextResponse.json({ error: `Availability for product with ID ${productId} not found` }, { status: 404 });
    }

    return NextResponse.json(availability);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/products/${productId}/availability`,
        method: 'GET',
        productId,
      },
      'Error fetching product availability',
    );
    return NextResponse.json({ error: 'Failed to fetch product availability' }, { status: 500 });
  }
}
