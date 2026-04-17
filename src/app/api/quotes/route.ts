import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteService } from '@/platform/services/quote/QuoteService';

/**
 * GET /api/quotes - Returns a list of quotes
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Parse query parameters (outside try for logging context)
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('query') || undefined;
  const sort = searchParams.get('sort') || undefined;

  try {
    const quoteService = server.get<QuoteService>('QuoteService');

    // Get quotes with filters
    const response = await quoteService.getQuotes({
      sort,
      query,
    });

    return NextResponse.json(response);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/quotes',
        method: 'GET',
        query,
        sort,
      },
      'Error fetching quotes',
    );
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
