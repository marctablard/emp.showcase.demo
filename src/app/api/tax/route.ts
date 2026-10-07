import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { TaxClassRate, TaxService } from '@/platform/services/tax/TaxService';

const ISO_COUNTRY_CODE = /^[A-Za-z]{2}$/;

function parseCountryCode(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!ISO_COUNTRY_CODE.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

/**
 * GET /api/tax
 * List tax classes for a destination country, optionally filtered by taxCode.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const countryCode = parseCountryCode(searchParams.get('countryCode'));
  const taxCode = searchParams.get('taxCode');

  try {
    if (!countryCode) {
      return NextResponse.json({ error: 'Missing required parameter: countryCode' }, { status: 400 });
    }

    const taxService = server.get<TaxService>('TaxService');
    let taxClasses: TaxClassRate[];

    if (taxCode) {
      const rate = await taxService.getTaxRate(countryCode, taxCode);
      taxClasses = rate === undefined ? [] : [{ code: taxCode, rate }];
    } else {
      taxClasses = await taxService.getTaxClasses(countryCode);
    }

    return NextResponse.json({ countryCode, taxClasses });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/tax',
        method: 'GET',
        countryCode,
        taxCode: taxCode || undefined,
      },
      'Error fetching tax classes',
    );
    return NextResponse.json({ error: 'Failed to fetch tax classes' }, { status: 500 });
  }
}
