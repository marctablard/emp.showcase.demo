import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { priceFetchOptionsFromSession } from '@/lib/common/price-match-session';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { PriceService } from '@/platform/services/price/PriceService';
import type { SessionService } from '@/platform/services/session/SessionService';

/**
 * API endpoint to get price for a specific product by ID
 * GET /api/products/[id]/price
 *
 * Query parameters:
 * - quantity: Optional number of items
 * - unitCode: Optional unit code
 * - currency: Optional currency override (avoids race condition with server-side session propagation)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const { searchParams } = new URL(request.url);
  const logger = server.get<LoggerService>('LoggerService');

  // Parse query parameters
  const quantity = searchParams.get('quantity') ? parseInt(searchParams.get('quantity') as string, 10) : undefined;
  const unitCode = searchParams.get('unitCode') || undefined;
  const currencyOverride = searchParams.get('currency') || undefined;

  try {
    // Get session
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Use client-provided currency if available to avoid race condition
    // between client-side session store and server-side session context propagation
    const currency = currencyOverride || session.currency;

    // Same explicit context as add-to-cart (site, currency, country, customer, LE).
    const priceService = server.get<PriceService>('PriceService');
    const price = await priceService.getProductPrice(productId, quantity, unitCode, {
      ...priceFetchOptionsFromSession({ ...session, currency }),
      siteCode: session.siteCode,
      currency,
      country: session.country,
      useFallback: false,
    });

    if (!price) {
      return NextResponse.json({ error: `Price for product with ID ${productId} not found` }, { status: 404 });
    }

    return NextResponse.json(price);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/products/${productId}/price`,
        method: 'GET',
        productId,
      },
      'Error fetching product price',
    );
    return NextResponse.json({ error: 'Failed to fetch product price' }, { status: 500 });
  }
}
