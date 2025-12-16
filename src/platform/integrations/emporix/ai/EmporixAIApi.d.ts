import { EmporixAIChatContext, EmporixAIChatResponse } from '../model/ai';

export interface EmporixAIApi {
  /**
   * Send a chat message with context to the AI service
   * @param userMessage User message
   * @param context AI chat context
   * @returns AI chat response
   */
  sendChatMessageWithContext(userMessage: string, context: EmporixAIChatContext): Promise<EmporixAIChatResponse>;
}
