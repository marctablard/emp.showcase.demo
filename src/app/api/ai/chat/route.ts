import { NextRequest, NextResponse } from 'next/server';
import { AIChatContext, AIChatRequest } from '@/platform/integrations/ai/model';
import server from '@/platform/server';
import { AIService } from '@/platform/services/ai';
import { SessionService } from '@/platform/services/session';

export const revalidate = 0;

/**
 * POST /api/ai/chat
 * Send a chat message to the AI service
 */
export async function POST(request: NextRequest) {
  try {
    const aiService = server.get<AIService>('AIService');
    const sessionService = server.get<SessionService>('SessionService');

    // Get current session for context
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const body = await request.json();

    // Handle different request formats
    let response;

    if (body.userMessage && body.context) {
      // Direct context format
      const context: AIChatContext = {
        ...body.context,
        siteId: body.context.siteId || session.siteCode,
        currency: body.context.currency || session.currency,
        language: body.context.language || session.language || 'en',
        sessionId: session.id,
      };

      response = await aiService.sendChatMessageWithContext(body.userMessage, context);
    } else if (body.agentId && body.message) {
      // Direct AI request format
      const aiRequest: AIChatRequest = {
        agentId: body.agentId,
        message: body.message,
      };

      response = await aiService.sendChatMessage(aiRequest);
    } else {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error handling AI chat request:', error);
    return NextResponse.json({ error: 'Failed to process AI chat request' }, { status: 500 });
  }
}
