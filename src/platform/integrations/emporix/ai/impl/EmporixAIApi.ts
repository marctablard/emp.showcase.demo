import { inject } from 'inversify';
import 'server-only';
import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
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
import { assembleEmporixChatStream } from '../assembleEmporixChatStream';

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

  private async streamChatMessage(
    request: EmporixAIChatRequest,
    sessionId?: string,
    onProgress?: (progress: AIChatStreamProgressUpdate) => void,
  ): Promise<EmporixAIChatResponse> {
    const url = `/ai-service/${this.config.tenant}/agentic/chat-stream`;

    const headers = {
      Accept: 'text/event-stream',
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
        createAiMetrics('/ai-service/{tenant}/agentic/chat-stream'),
      );

      if (!response.ok) {
        throw new Error(`Emporix AI service request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Emporix AI service stream response body is missing');
      }

      return await assembleEmporixChatStream(response.body, onProgress);
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

  async streamChatMessageWithContext(
    userMessage: string,
    context: EmporixAIChatContext,
    onProgress?: (progress: AIChatStreamProgressUpdate) => void,
  ): Promise<EmporixAIChatResponse> {
    const userMessageObj: EmporixAIUserMessage = {
      userMessage,
      context,
    };

    const request: EmporixAIChatRequest = {
      agentId: 'frontendAgent',
      message: JSON.stringify(userMessageObj),
    };

    return this.streamChatMessage(request, context.sessionId, onProgress);
  }
}

export default EmporixAIApi;
