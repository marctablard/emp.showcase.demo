import { inject } from 'inversify';
import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import { injectable } from '@/platform/core/di/injectable';
import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import type { EmporixAIChatContext, EmporixAIChatResponse } from '@/platform/integrations/emporix/model/ai';
import type { EmporixOrderApi } from '@/platform/integrations/emporix/order/EmporixOrderApi';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import type { EmporixQuoteApi } from '@/platform/integrations/emporix/quote/EmporixQuoteApi';
import type { EmporixReturnApi } from '@/platform/integrations/emporix/return/EmporixReturnApi';
import type { AIService } from '../AIService';
import { type AiWidgetEntityFetchers, hydrateAiWidgetReferences } from '../hydrateAiWidgetReferences';
import { isAiChatStreamingEnabled } from '../isAiChatStreamingEnabled';

@injectable('AIService', 'Singleton')
export class AIServiceImpl implements AIService {
  private readonly entityFetchers: AiWidgetEntityFetchers;

  constructor(
    @inject('EmporixAIApi') private aiApi: EmporixAIApi,
    @inject('EmporixOrderApi') orderApi: EmporixOrderApi,
    @inject('EmporixProductApi') productApi: EmporixProductApi,
    @inject('EmporixQuoteApi') quoteApi: EmporixQuoteApi,
    @inject('EmporixReturnApi') returnApi: EmporixReturnApi,
  ) {
    this.entityFetchers = {
      order: (id) => orderApi.getCustomerOrder(id),
      product: (id) => productApi.getProduct(id),
      quote: (id) => quoteApi.getQuote(id),
      return: (id) => returnApi.getReturn(id),
    };
  }

  async sendChatMessageWithContext(
    userMessage: string,
    context: AIChatContext,
    onProgress?: (progress: AIChatStreamProgressUpdate) => void,
  ): Promise<AIChatResponse> {
    const emporixContext = this.convertToEmporixContext(context);
    const emporixResponse = isAiChatStreamingEnabled()
      ? await this.aiApi.streamChatMessageWithContext(userMessage, emporixContext, onProgress)
      : await this.aiApi.sendChatMessageWithContext(userMessage, emporixContext);
    const message = await hydrateAiWidgetReferences(emporixResponse.message, this.entityFetchers);
    return this.convertFromEmporixResponse({ ...emporixResponse, message });
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
    if (context.subscriptions) {
      emporixContext.subscriptions = context.subscriptions;
    }

    return emporixContext;
  }
}

export default AIServiceImpl;
