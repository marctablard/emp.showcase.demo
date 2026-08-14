import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { type AIChatStreamEvent, encodeAiChatSse } from '@/lib/common/ai-chat-stream';
import { getPublicDefaultCurrency, getPublicDefaultLanguage } from '@/lib/common/public-default-env';
import type { AIChatContext } from '@/platform/integrations/ai/model';
import server from '@/platform/server';
import type { AIService } from '@/platform/services/ai';
import { isAiChatStreamingEnabled } from '@/platform/services/ai/isAiChatStreamingEnabled';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session';
import { AIChatRequestSchema } from './schema';

export const revalidate = 0;
export const maxDuration = 120;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function isRetryableError(error: unknown): boolean {
  return error instanceof Error && (error.message.includes('timeout') || error.message.includes('network'));
}

function logChatError(error: unknown, retryable: boolean): void {
  const logger = server.get<LoggerService>('LoggerService');
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: '/api/ai/chat',
      method: 'POST',
      retryable,
    },
    'Error processing AI chat request',
  );
}

function createChatSseResponse(run: (send: (event: AIChatStreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AIChatStreamEvent) => {
        controller.enqueue(encoder.encode(encodeAiChatSse(event)));
      };

      try {
        await run(send);
      } catch (error) {
        const retryable = isRetryableError(error);
        logChatError(error, retryable);
        send({
          type: 'error',
          code: 'AI_SERVICE_ERROR',
          error: 'Failed to process AI chat request',
          retryable,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * POST /api/ai/chat
 * Send a chat message to the AI service
 */
export async function POST(request: NextRequest) {
  try {
    const aiService = server.get<AIService>('AIService');
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();

    if (!session) {
      return NextResponse.json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = AIChatRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { userMessage, context: requestContext } = validationResult.data;

    const context: AIChatContext = {
      ...requestContext,
      siteId: requestContext.siteId || session.siteCode || 'default',
      currency: requestContext.currency || session.currency || getPublicDefaultCurrency(),
      language: requestContext.language || session.language || getPublicDefaultLanguage(),
      sessionId: requestContext.sessionId,
      cartId: requestContext.cartId,
    };

    if (isAiChatStreamingEnabled()) {
      return createChatSseResponse(async (send) => {
        send({ type: 'progress', chunks: 0 });
        const response = await aiService.sendChatMessageWithContext(userMessage, context, (chunks) => {
          send({ type: 'progress', chunks });
        });
        send({ type: 'complete', ...response });
      });
    }

    const response = await aiService.sendChatMessageWithContext(userMessage, context);
    return NextResponse.json(response);
  } catch (error) {
    const retryable = isRetryableError(error);
    logChatError(error, retryable);

    return NextResponse.json(
      {
        error: 'Failed to process AI chat request',
        code: 'AI_SERVICE_ERROR',
        retryable,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
