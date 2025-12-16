import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ShippingService } from '@/platform/services/shipping/ShippingService';

/**
 * GET /api/shipping
 * Get shipping methods for a country and postal code
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const countryCode = searchParams.get('countryCode');
    const postalCode = searchParams.get('postalCode');
    const amount = searchParams.get('amount');
    const currency = searchParams.get('currency');

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
    console.error('Error fetching shipping methods:', error);
    return NextResponse.json({ error: 'Failed to fetch shipping methods' }, { status: 500 });
  }
}

/**
 * POST /api/shipping
 * Get a specific shipping method by ID and zone (expects JSON body: { methodId, zoneId })
 */
export async function POST(request: NextRequest) {
  try {
    const { methodId, zoneId } = await request.json();

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
    console.error('Error fetching shipping method:', error);
    return NextResponse.json({ error: 'Failed to fetch shipping method' }, { status: 500 });
  }
}
