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
  const query = searchParams.get('q') || searchParams.get('query') || undefined;
  const sort = searchParams.get('sort') || undefined;
  const rawPage = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
  const rawSize = searchParams.get('size') ? Number(searchParams.get('size')) : undefined;
  const page = Number.isFinite(rawPage) && rawPage! >= 0 ? rawPage : undefined;
  const size = Number.isFinite(rawSize) && rawSize! > 0 ? rawSize : undefined;

  // Collect filter params (everything except known control params)
  const reservedKeys = new Set(['q', 'query', 'sort', 'page', 'size']);
  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (!reservedKeys.has(key)) {
      filters[key] = value;
    }
  });

  try {
    const quoteService = server.get<QuoteService>('QuoteService');

    const response = await quoteService.getQuotes({
      sort,
      query,
      page,
      size,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
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
