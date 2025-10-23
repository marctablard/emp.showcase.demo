import { AIChatContext, AIChatRequest, AIChatResponse } from '@/platform/integrations/ai/model';

/**
 * Send a chat message to the AI service
 * @param request Chat request with agent ID and message
 * @returns Promise with the AI response
 */
export async function sendAIChatMessage(request: AIChatRequest): Promise<AIChatResponse> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`AI service request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
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

/**
 * Get cart summary from AI service
 * @param cartId The cart ID
 * @param siteId The site ID
 * @param currency The currency
 * @param language The language
 * @returns Promise with cart summary response
 */
export async function getAICartSummary(
  cartId: string,
  siteId: string,
  currency: string,
  language: string,
): Promise<AIChatResponse> {
  const context: AIChatContext = {
    cartId,
    siteId,
    currency,
    language,
  };

  return sendAIChatMessageWithContext('show my cart', context);
}
