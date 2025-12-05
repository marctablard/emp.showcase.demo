import { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';

/**
 * Interface for AI Service operations
 */
export interface AIService {
  /**
   * Send a chat message with context to the AI service
   * @param userMessage The user's message
   * @param context Additional context for the AI
   * @returns Promise with the AI response
   */
  sendChatMessageWithContext(userMessage: string, context: AIChatContext): Promise<AIChatResponse>;
}
