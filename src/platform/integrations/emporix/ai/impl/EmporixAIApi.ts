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

  async sendChatMessage(request: EmporixAIChatRequest, sessionId?: string): Promise<EmporixAIChatResponse> {
    const url = `/ai-service/${this.config.tenant}/agentic/chat`;

    console.log('Emporix AI Service URL:', url);
    console.log('Emporix AI Service Request:', JSON.stringify(request, null, 2));

    try {
      const response = await this.apiClient.authenticatedFetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionId && { 'session-id': sessionId }),
          },
          body: JSON.stringify(request),
        },
        'session',
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
      console.log('Emporix AI Service Response:', JSON.stringify(data, null, 2));
      return data as EmporixAIChatResponse;
    } catch (error) {
      console.error('Error calling Emporix AI service:', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
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
