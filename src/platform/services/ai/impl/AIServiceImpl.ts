import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import type { AIService } from '../AIService';

@injectable('AIService', 'Singleton')
export class AIServiceImpl implements AIService {
  constructor(@inject('EmporixAIApi') private aiApi: EmporixAIApi) {}

  async sendChatMessageWithContext(userMessage: string, context: AIChatContext): Promise<AIChatResponse> {
    const emporixContext = this.convertToEmporixContext(context);
    const emporixResponse = await this.aiApi.sendChatMessageWithContext(userMessage, emporixContext);
    return this.convertFromEmporixResponse(emporixResponse);
  }

  private convertFromEmporixResponse(response: any): AIChatResponse {
    return {
      agentId: response.agentId,
      agentType: response.agentType,
      message: response.message,
      sessionId: response.sessionId,
    };
  }

  private convertToEmporixContext(context: AIChatContext): any {
    const emporixContext: any = {
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
