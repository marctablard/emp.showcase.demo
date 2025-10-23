import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import { AIChatContext, AIChatRequest, AIChatResponse, AIParsedMessage } from '@/platform/integrations/ai/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import { AIService } from '../AIService';

@injectable('AIService', 'Singleton')
export class AIServiceImpl implements AIService {
  constructor(@inject('EmporixAIApi') private aiApi: EmporixAIApi) {}

  /**
   * Send a chat message to the AI service
   */
  async sendChatMessage(request: AIChatRequest): Promise<AIChatResponse> {
    const emporixRequest = this.convertToEmporixRequest(request);
    const emporixResponse = await this.aiApi.sendChatMessage(emporixRequest);
    return this.convertFromEmporixResponse(emporixResponse);
  }

  /**
   * Send a chat message with context to the AI service
   */
  async sendChatMessageWithContext(userMessage: string, context: AIChatContext): Promise<AIChatResponse> {
    const emporixContext = this.convertToEmporixContext(context);
    const emporixResponse = await this.aiApi.sendChatMessageWithContext(userMessage, emporixContext);
    return this.convertFromEmporixResponse(emporixResponse);
  }

  /**
   * Parse the AI response message to extract structured data
   */
  parseResponseMessage(response: AIChatResponse): AIParsedMessage | null {
    try {
      const parsedMessage = JSON.parse(response.message);
      return parsedMessage as AIParsedMessage;
    } catch (error) {
      console.error('Error parsing AI response message:', error);
      return null;
    }
  }

  /**
   * Get cart summary from AI service
   */
  async getCartSummary(cartId: string, siteId: string, currency: string, language: string): Promise<AIChatResponse> {
    const context: AIChatContext = {
      cartId,
      siteId,
      currency,
      language,
    };

    return this.sendChatMessageWithContext('show my cart', context);
  }

  /**
   * Convert AI request to Emporix AI request
   */
  private convertToEmporixRequest(request: AIChatRequest): any {
    return {
      agentId: request.agentId,
      message: request.message,
    };
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
    return {
      cartId: context.cartId,
      siteId: context.siteId,
      currency: context.currency,
      language: context.language,
      sessionId: context.sessionId,
    };
  }
}

export default AIServiceImpl;
