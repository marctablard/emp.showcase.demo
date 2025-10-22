import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { QuoteService } from '@/platform/services/quote/QuoteService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get('quoteId');

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 });
    }

    const quoteService = server.get<QuoteService>('QuoteService');
    const history = await quoteService.getQuoteHistory(quoteId);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Failed to fetch quote history:', error);
    return NextResponse.json({ error: 'Failed to fetch quote history' }, { status: 500 });
  }
}
