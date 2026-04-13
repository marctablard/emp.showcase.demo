import { NextRequest, NextResponse } from 'next/server';
import type { EmporixQuoteApi } from '@/platform/integrations/emporix/quote/EmporixQuoteApi';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { QuoteUpdateRequest } from '@/platform/services/model/quote';
import type { QuoteService } from '@/platform/services/quote/QuoteService';
import type { SchemaService } from '@/platform/services/schema/SchemaService';

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

    const quoteApi = server.get<EmporixQuoteApi>('EmporixQuoteApi');
    const schemaService = server.get<SchemaService>('SchemaService');
    const quoteService = server.get<QuoteService>('QuoteService');

    const emporixQuote = await quoteApi.getQuote(quoteId);
    const mixinValue = { reference: body.reference, userComment: comment };
    const updateList: QuoteUpdateRequest[] = [];

    if (emporixQuote.mixins?.additionalInfo !== undefined) {
      updateList.push({
        op: 'REPLACE',
        path: '/mixins/additionalInfo',
        value: mixinValue,
      });
    } else {
      const quoteMixinSchema = await schemaService.getSchema('additionalInfo');
      updateList.push({
        op: 'ADD',
        path: '/mixins/additionalInfo',
        value: mixinValue,
      });
      if (quoteMixinSchema.metadata?.url) {
        updateList.push({
          op: 'ADD',
          path: '/metadata/mixins/additionalInfo',
          value: quoteMixinSchema.metadata.url,
        });
      }
    }

    await quoteService.updateQuote(quoteId, updateList, 'service');

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
