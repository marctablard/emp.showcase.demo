import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteService } from '@/platform/services/quote/QuoteService';

/**
 * GET /api/quotes/[id] - Returns details of a specific quote
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quoteId } = await params;
  try {
    const quoteService = server.get<QuoteService>('QuoteService');

    const quote = await quoteService.getQuote(quoteId);

    return NextResponse.json(quote);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/quotes/${quoteId}`,
        method: 'GET',
        quoteId,
      },
      `Error fetching quote ${quoteId}`,
    );
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}
