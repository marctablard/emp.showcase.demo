import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { PriceService } from '@/platform/services/price/PriceService';
import { SessionService } from '@/platform/services/session/SessionService';

/**
 * API endpoint to get price for a specific product by ID
 * GET /api/products/[id]/price
 *
 * Query parameters:
 * - quantity: Optional number of items
 * - unitCode: Optional unit code
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const quantity = searchParams.get('quantity') ? parseInt(searchParams.get('quantity') as string, 10) : undefined;
    const unitCode = searchParams.get('unitCode') || undefined;

    // Get session
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get price service and fetch price
    const priceService = server.get<PriceService>('PriceService');
    const price = await priceService.getProductPrice(productId, quantity, unitCode);

    if (!price) {
      return NextResponse.json({ error: `Price for product with ID ${productId} not found` }, { status: 404 });
    }

    return NextResponse.json(price);
  } catch (error) {
    console.error('Error fetching product price:', error);
    return NextResponse.json({ error: 'Failed to fetch product price' }, { status: 500 });
  }
}
