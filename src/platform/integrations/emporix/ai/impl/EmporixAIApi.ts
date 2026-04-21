import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixAIChatContext,
  EmporixAIChatRequest,
  EmporixAIChatResponse,
  EmporixAIUserMessage,
} from '../../model/ai';
import type { EmporixAIApi as IEmporixAIApi } from '../EmporixAIApi';

const createAiMetrics = (route: string) => createFetchMetricsParams('ai', route);

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

    try {
      const response = await this.apiClient.authenticatedFetch(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
        },
        'ai',
        undefined,
        createAiMetrics('/ai-service/{tenant}/agentic/chat'),
      );

      if (!response.ok) {
        throw new Error(`Emporix AI service request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as EmporixAIChatResponse;
    } catch (error) {
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
