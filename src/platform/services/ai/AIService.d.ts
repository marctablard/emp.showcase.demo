import { AIChatContext, AIChatRequest, AIChatResponse, AIParsedMessage } from '@/platform/integrations/ai/model';

/**
 * Interface for AI Service operations
 */
export interface AIService {
  /**
   * Send a chat message to the AI service
   * @param request Chat request with agent ID and message
   * @returns Promise with the AI response
   */
  sendChatMessage(request: AIChatRequest): Promise<AIChatResponse>;

  /**
   * Send a chat message with context to the AI service
   * @param userMessage The user's message
   * @param context Additional context for the AI
   * @returns Promise with the AI response
   */
  sendChatMessageWithContext(userMessage: string, context: AIChatContext): Promise<AIChatResponse>;

  /**
   * Parse the AI response message to extract structured data
   * @param response The AI response
   * @returns Parsed message with structured data
   */
  parseResponseMessage(response: AIChatResponse): AIParsedMessage | null;

  /**
   * Get cart summary from AI service
   * @param cartId The cart ID
   * @param siteId The site ID
   * @param currency The currency
   * @param language The language
   * @returns Promise with cart summary response
   */
  getCartSummary(cartId: string, siteId: string, currency: string, language: string): Promise<AIChatResponse>;
}
