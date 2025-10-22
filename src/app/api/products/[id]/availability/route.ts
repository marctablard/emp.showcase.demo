import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SessionService } from '@/platform/services/session/SessionService';
import { StockService } from '@/platform/services/stock/StockService';

/**
 * API endpoint to get availability for a specific product by ID
 * GET /api/products/[id]/availability
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
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
    console.error('Error fetching product availability:', error);
    return NextResponse.json({ error: 'Failed to fetch product availability' }, { status: 500 });
  }
}
