import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ShippingService } from '@/platform/services/shipping/ShippingService';

/**
 * GET /api/shipping
 * Get shipping methods for a country and postal code
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const countryCode = searchParams.get('countryCode');
  const postalCode = searchParams.get('postalCode');
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency');

  try {
    if (!countryCode || !postalCode) {
      return NextResponse.json({ error: 'Missing required parameters: countryCode and postalCode' }, { status: 400 });
    }

    const shippingService = server.get<ShippingService>('ShippingService');
    let orderValue = undefined;
    if (amount && currency) {
      orderValue = { amount: Number(amount), currency };
    }
    const methods = await shippingService.getShippingMethods(countryCode, postalCode, orderValue);

    return NextResponse.json(methods);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/shipping',
        method: 'GET',
        countryCode,
        postalCode,
      },
      'Error fetching shipping methods',
    );
    return NextResponse.json({ error: 'Failed to fetch shipping methods' }, { status: 500 });
  }
}

/**
 * POST /api/shipping
 * Get a specific shipping method by ID and zone (expects JSON body: { methodId, zoneId })
 */
export async function POST(request: NextRequest) {
  let methodId: string | undefined;
  let zoneId: string | undefined;

  try {
    const body = await request.json();
    methodId = body.methodId;
    zoneId = body.zoneId;

    if (!methodId || !zoneId) {
      return NextResponse.json({ error: 'Missing required parameters: methodId and zoneId' }, { status: 400 });
    }

    const shippingService = server.get<ShippingService>('ShippingService');

    const method = await shippingService.getShippingMethod(methodId, zoneId);

    if (!method) {
      return NextResponse.json({ error: 'Shipping method not found' }, { status: 404 });
    }

    return NextResponse.json(method);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/shipping',
        method: 'POST',
        methodId,
        zoneId,
      },
      'Error fetching shipping method',
    );
    return NextResponse.json({ error: 'Failed to fetch shipping method' }, { status: 500 });
  }
}
