import { EmporixAIChatContext, EmporixAIChatRequest, EmporixAIChatResponse } from '../model/ai';

export interface EmporixAIApi {
  /**
   * Send a chat message to the AI service
   * @param request AI chat request
   * @returns AI chat response
   */
  sendChatMessage(request: EmporixAIChatRequest): Promise<EmporixAIChatResponse>;

  /**
   * Send a chat message with context to the AI service
   * @param userMessage User message
   * @param context AI chat context
   * @returns AI chat response
   */
  sendChatMessageWithContext(userMessage: string, context: EmporixAIChatContext): Promise<EmporixAIChatResponse>;
}
