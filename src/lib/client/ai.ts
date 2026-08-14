import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';
import type { Session } from '@/platform/services/model/session/session';
import type { CartStore } from '@/stores/cart-store';
import { readAIChatSseResponse } from './ai-chat-stream';
import { getOrCreateAISessionId, isAIHelperStorageOwnerId } from './ai-helper-storage';

export async function prepareAIContext(session: Session, cartStore: CartStore): Promise<AIChatContext> {
  const ownerId = isAIHelperStorageOwnerId(session.customerId) ? session.customerId : undefined;
  const aiSessionId = getOrCreateAISessionId(ownerId);
  await cartStore.fetchCart();
  const currentCart = cartStore.getCurrentCart();
  const freshCartId = currentCart?.id;

  return {
    siteId: session.siteCode,
    currency: session.currency,
    language: session.language || 'en_US',
    sessionId: aiSessionId,
    cartId: freshCartId || undefined,
  };
}

export async function sendAIChatMessageWithContext(
  userMessage: string,
  context: AIChatContext,
  onProgress?: (chunks: number) => void,
): Promise<AIChatResponse> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userMessage,
      context,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI service request failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    if (!response.body) {
      throw new Error('AI service stream response body is missing');
    }
    return readAIChatSseResponse(response.body, onProgress);
  }

  return await response.json();
}
