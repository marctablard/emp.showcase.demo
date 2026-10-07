import { inject } from 'inversify';
import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import { injectable } from '@/platform/core/di/injectable';
import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import type { EmporixAIChatContext, EmporixAIChatResponse } from '@/platform/integrations/emporix/model/ai';
import type { AIService } from '../AIService';
import { isAiChatStreamingEnabled } from '../isAiChatStreamingEnabled';

@injectable('AIService', 'Singleton')
export class AIServiceImpl implements AIService {
  constructor(@inject('EmporixAIApi') private aiApi: EmporixAIApi) {}

  async sendChatMessageWithContext(
    userMessage: string,
    context: AIChatContext,
    onProgress?: (progress: AIChatStreamProgressUpdate) => void,
  ): Promise<AIChatResponse> {
    const emporixContext = this.convertToEmporixContext(context);
    const emporixResponse = isAiChatStreamingEnabled()
      ? await this.aiApi.streamChatMessageWithContext(userMessage, emporixContext, onProgress)
      : await this.aiApi.sendChatMessageWithContext(userMessage, emporixContext);
    return this.convertFromEmporixResponse(emporixResponse);
  }

  private convertFromEmporixResponse(response: EmporixAIChatResponse): AIChatResponse {
    return {
      agentId: response.agentId,
      agentType: response.agentType,
      message: response.message,
      sessionId: response.sessionId,
    };
  }

  private convertToEmporixContext(context: AIChatContext): EmporixAIChatContext {
    const emporixContext: EmporixAIChatContext = {
      siteId: context.siteId,
      currency: context.currency,
      language: context.language,
      sessionId: context.sessionId,
    };

    if (context.cartId) {
      emporixContext.cartId = context.cartId;
    }

    return emporixContext;
  }
}

export default AIServiceImpl;
