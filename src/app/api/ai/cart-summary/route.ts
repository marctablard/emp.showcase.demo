import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { AIService } from '@/platform/services/ai';
import { SessionService } from '@/platform/services/session';

export const revalidate = 0;

/**
 * GET /api/ai/cart-summary
 * Get cart summary from AI service
 */
export async function GET(request: NextRequest) {
  try {
    const aiService = server.get<AIService>('AIService');
    const sessionService = server.get<SessionService>('SessionService');

    // Get current session for context
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    // Get cart ID from query parameters or session
    const { searchParams } = new URL(request.url);
    const cartId = searchParams.get('cartId');

    if (!cartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 });
    }

    // Get cart summary from AI service
    const response = await aiService.getCartSummary(
      cartId,
      session.siteCode,
      session.currency,
      session.language || 'en',
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting AI cart summary:', error);
    return NextResponse.json({ error: 'Failed to get cart summary' }, { status: 500 });
  }
}
