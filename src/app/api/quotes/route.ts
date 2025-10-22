import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { QuoteService } from '@/platform/services/quote/QuoteService';

/**
 * GET /api/quotes - Returns a list of quotes
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const quoteService = server.get<QuoteService>('QuoteService');

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query') || undefined;
    const sort = searchParams.get('sort') || undefined;

    // Get quotes with filters
    const response = await quoteService.getQuotes({
      sort,
      query,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
