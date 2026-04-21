import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';
import type { Session } from '@/platform/services/model/session/session';
import type { CartStore } from '@/stores/cart-store';

function getOrCreateAISessionId(): string {
  const stored = localStorage.getItem('ai-session-id');
  if (stored) {
    return stored;
  }
  const newSessionId = crypto.randomUUID();
  localStorage.setItem('ai-session-id', newSessionId);
  return newSessionId;
}

export async function prepareAIContext(session: Session, cartStore: CartStore): Promise<AIChatContext> {
  const aiSessionId = getOrCreateAISessionId();
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

  return await response.json();
}
