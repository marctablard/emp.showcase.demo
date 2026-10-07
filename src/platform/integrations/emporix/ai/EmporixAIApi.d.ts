import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import type { EmporixAIChatContext, EmporixAIChatResponse } from '../model/ai';

export interface EmporixAIApi {
  /**
   * Send a chat message with context to the AI service
   * @param userMessage User message
   * @param context AI chat context
   * @returns AI chat response
   */
  sendChatMessageWithContext(userMessage: string, context: EmporixAIChatContext): Promise<EmporixAIChatResponse>;

  /**
   * Send a chat message with context to the AI streaming service
   * @param userMessage User message
   * @param context AI chat context
   * @param onProgress Optional callback after each upstream SSE data payload with preview
   * @returns AI chat response assembled from stream
   */
  streamChatMessageWithContext(
    userMessage: string,
    context: EmporixAIChatContext,
    onProgress?: (progress: AIChatStreamProgressUpdate) => void,
  ): Promise<EmporixAIChatResponse>;
}
