import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AIChatContext } from '@/platform/integrations/ai/model';
import server from '@/platform/server';
import type { AIService } from '@/platform/services/ai';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session';
import { AIChatRequestSchema } from './schema';

export const revalidate = 0;
export const maxDuration = 120;

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
      currency: requestContext.currency || session.currency || 'EUR',
      language: requestContext.language || session.language || 'en',
      sessionId: requestContext.sessionId,
      cartId: requestContext.cartId,
    };

    const response = await aiService.sendChatMessageWithContext(userMessage, context);
    return NextResponse.json(response);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const isRetryable =
      error instanceof Error && (error.message.includes('timeout') || error.message.includes('network'));

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/ai/chat',
        method: 'POST',
        retryable: isRetryable,
      },
      'Error processing AI chat request',
    );

    return NextResponse.json(
      {
        error: 'Failed to process AI chat request',
        code: 'AI_SERVICE_ERROR',
        retryable: isRetryable,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
