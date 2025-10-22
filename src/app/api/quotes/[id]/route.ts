import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { QuoteService } from '@/platform/services/quote/QuoteService';

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
    console.error(`Error fetching quote ${quoteId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}
