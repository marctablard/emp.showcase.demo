import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import {
  EmporixAIChatContext,
  EmporixAIChatRequest,
  EmporixAIChatResponse,
  EmporixAIUserMessage,
} from '../../model/ai';
import { EmporixAIApi as IEmporixAIApi } from '../EmporixAIApi';

@injectable('EmporixAIApi', 'Singleton')
class EmporixAIApi implements IEmporixAIApi {
  constructor(
    @inject('EmporixApiInvoker') private apiClient: EmporixApiClient,
    @inject('EmporixConfig') private config: EmporixConfig,
  ) {}

  private async sendChatMessage(request: EmporixAIChatRequest, sessionId?: string): Promise<EmporixAIChatResponse> {
    const url = `/ai-service/${this.config.tenant}/agentic/chat`;

    const headers = {
      'Content-Type': 'application/json',
      ...(sessionId && { 'session-id': sessionId }),
    };

    // Log request to Emporix backend
    console.log(
      'EmporixAIApi Request to Backend:',
      JSON.stringify(
        {
          url,
          method: 'POST',
          headers,
          body: request,
          sessionId,
        },
        null,
        2,
      ),
    );

    try {
      const response = await this.apiClient.authenticatedFetch(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
        },
        'ai',
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Emporix AI service response error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Emporix AI service request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as EmporixAIChatResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI service request timed out after 50 seconds');
      }

      console.error('Error calling Emporix AI service:', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`Failed to send chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendChatMessageWithContext(userMessage: string, context: EmporixAIChatContext): Promise<EmporixAIChatResponse> {
    const userMessageObj: EmporixAIUserMessage = {
      userMessage,
      context,
    };

    const request: EmporixAIChatRequest = {
      agentId: 'frontendAgent',
      message: JSON.stringify(userMessageObj),
    };

    return this.sendChatMessage(request, context.sessionId);
  }
}

export default EmporixAIApi;
