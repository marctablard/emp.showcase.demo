import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteUpdateRequest } from '@/platform/services/model/quote';
import type { QuoteService } from '@/platform/services/quote/QuoteService';

export async function POST(request: NextRequest) {
  let quoteId: string | undefined;
  let status: string | undefined;

  try {
    const body = await request.json();
    quoteId = body.quoteId;
    status = body.status;
    const { comment, locale, oldStatus } = body;

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
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/quote/update-status',
        method: 'POST',
        quoteId,
        status,
      },
      'Error updating quote status',
    );
    const message = error instanceof Error ? error.message : 'Failed to update quote status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
