import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';

/**
 * Interface for AI Service operations
 */
export interface AIService {
  /**
   * Send a chat message with context to the AI service
   * @param userMessage The user's message
   * @param context Additional context for the AI
   * @param onProgress Optional callback with upstream SSE chunk counts and preview while streaming
   * @returns Promise with the AI response
   */
  sendChatMessageWithContext(
    userMessage: string,
    context: AIChatContext,
    onProgress?: (progress: AIChatStreamProgressUpdate) => void,
  ): Promise<AIChatResponse>;
}
