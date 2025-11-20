import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import { AIService } from '../AIService';

@injectable('AIService', 'Singleton')
export class AIServiceImpl implements AIService {
  constructor(@inject('EmporixAIApi') private aiApi: EmporixAIApi) {}

  /**
   * Send a chat message with context to the AI service
   */
  async sendChatMessageWithContext(userMessage: string, context: AIChatContext): Promise<AIChatResponse> {
    // Log service-side request
    console.log('AIService Request to Emporix API:', JSON.stringify({
      userMessage,
      context,
      hasCartId: !!context.cartId,
      cartId: context.cartId,
    }, null, 2));

    const emporixContext = this.convertToEmporixContext(context);
    console.log('AIService Converted Emporix Context:', JSON.stringify(emporixContext, null, 2));
    
    const emporixResponse = await this.aiApi.sendChatMessageWithContext(userMessage, emporixContext);
    console.log('Raw Emporix AI Response:', JSON.stringify(emporixResponse, null, 2));
    return this.convertFromEmporixResponse(emporixResponse);
  }

  /**
   * Convert Emporix AI response to AI response
   */
  private convertFromEmporixResponse(response: any): AIChatResponse {
    return {
      agentId: response.agentId,
      agentType: response.agentType,
      message: response.message,
      sessionId: response.sessionId,
    };
  }

  /**
   * Convert AI context to Emporix AI context
   */
  private convertToEmporixContext(context: AIChatContext): any {
    const emporixContext: any = {
      siteId: context.siteId,
      currency: context.currency,
      language: context.language,
      sessionId: context.sessionId,
    };
    
    // Only include cartId if it exists (don't include undefined)
    if (context.cartId) {
      emporixContext.cartId = context.cartId;
    }
    
    return emporixContext;
  }
}

export default AIServiceImpl;

