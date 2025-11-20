import { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';
import type { CartStore } from '@/stores/cart-store';
import { Session } from '@/platform/services/model/session/session';

/**
 * Gets or creates an AI session ID from localStorage
 * Only writes to localStorage if the value doesn't exist
 */
function getOrCreateAISessionId(): string {
  const stored = localStorage.getItem('ai-session-id');
  if (stored) {
    return stored;
  }
  const newSessionId = crypto.randomUUID();
  localStorage.setItem('ai-session-id', newSessionId);
  return newSessionId;
}

/**
 * Prepares AI context with fresh cart and AI session ID
 * Fetches the latest cart state and creates the context object
 */
export async function prepareAIContext(
  session: Session,
  cartStore: CartStore,
): Promise<AIChatContext> {
  // Get or create AI-specific session ID
  const aiSessionId = getOrCreateAISessionId();

  // Always fetch the latest cart state before getting cartId
  // This ensures we have the most up-to-date cart information
  await cartStore.fetchCart(true);
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

/**
 * Send a chat message with context to the AI service
 * @param userMessage The user's message
 * @param context Additional context for the AI
 * @returns Promise with the AI response
 */
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
