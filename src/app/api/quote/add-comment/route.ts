import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteService } from '@/platform/services/quote/QuoteService';

const MAX_COMMENT_LENGTH = 500;

export async function POST(request: NextRequest) {
  let quoteId: string | undefined;

  try {
    const body = await request.json();
    quoteId = body.quoteId;
    const { comment } = body;

    if (!quoteId || !comment) {
      return NextResponse.json({ error: 'Quote ID and comment are required' }, { status: 400 });
    }

    if (typeof comment !== 'string' || comment.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: `Comment must be at most ${MAX_COMMENT_LENGTH} characters` }, { status: 400 });
    }

    const quoteService = server.get<QuoteService>('QuoteService');
    await quoteService.addQuoteUserComment(quoteId, { comment, reference: body.reference });

    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/quote/add-comment',
        method: 'POST',
        quoteId,
      },
      'Error adding comment to quote',
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add comment to quote' },
      { status: 500 },
    );
  }
}
