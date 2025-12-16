import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { QuoteUpdateRequest } from '@/platform/services/model/quote';
import { QuoteService } from '@/platform/services/quote/QuoteService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId, status, comment, locale, oldStatus } = body;

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const quoteService = server.get<QuoteService>('QuoteService');

    let quoteReasonId = undefined;
    if (status === 'DECLINED' || oldStatus === 'OPEN') {
      const reasonType = status === 'DECLINED' ? 'DECLINE' : 'CHANGE';
      quoteReasonId = await quoteService.createQuoteReason(quoteId, comment, locale, reasonType);
    }
    const updateList: QuoteUpdateRequest[] = [];
    updateList.push({
      op: 'REPLACE',
      path: '/status',
      value: { value: status, comment: comment || '', quoteReasonId: quoteReasonId || '' },
    });
    await quoteService.updateQuote(quoteId, updateList, 'session');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error updating quote status:', error);
    const message = error instanceof Error ? error.message : 'Failed to update quote status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
