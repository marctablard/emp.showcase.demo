import { NextRequest, NextResponse } from 'next/server';
import { AIChatContext } from '@/platform/integrations/ai/model';
import server from '@/platform/server';
import { AIService } from '@/platform/services/ai';
import { SessionService } from '@/platform/services/session';

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
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.userMessage || !body.context) {
      return NextResponse.json({ error: 'Invalid request format. userMessage and context are required.' }, { status: 400 });
    }

    // Log incoming AI request
    console.log('AI Chat API Request:', JSON.stringify({
      userMessage: body.userMessage,
      context: body.context,
      hasCartId: !!body.context.cartId,
      cartId: body.context.cartId,
      session: {
        id: session.id,
        siteCode: session.siteCode,
        currency: session.currency,
        language: session.language,
      },
    }, null, 2));

    const context: AIChatContext = {
      ...body.context,
      siteId: body.context.siteId || session.siteCode,
      currency: body.context.currency || session.currency,
      language: body.context.language || session.language,
      sessionId: body.context.sessionId,
      // Preserve cartId from client context
      cartId: body.context.cartId,
    };
    const response = await aiService.sendChatMessageWithContext(body.userMessage, context);
    console.log('AI Service Response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error handling AI chat request:', error);
    return NextResponse.json({ error: 'Failed to process AI chat request' }, { status: 500 });
  }
}
