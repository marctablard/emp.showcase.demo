import type { AIChatContext } from '@/platform/integrations/ai/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import type { EmporixAIChatResponse } from '@/platform/integrations/emporix/model/ai';
import { AIServiceImpl } from './AIServiceImpl';

describe('AIServiceImpl', () => {
  const originalStreamingFlag = process.env.NEXT_AI_CHAT_STREAMING;

  const baseContext: AIChatContext = {
    siteId: 'main',
    currency: 'EUR',
    language: 'en',
    sessionId: 'session-1',
  };

  const streamResponse: EmporixAIChatResponse = {
    agentId: 'frontendAgent',
    agentType: 'generic',
    message: 'stream-message',
    sessionId: 'stream-session',
  };

  const batchResponse: EmporixAIChatResponse = {
    agentId: 'frontendAgent',
    agentType: 'generic',
    message: 'batch-message',
    sessionId: 'batch-session',
  };

  function createApiMock(): jest.Mocked<
    Pick<EmporixAIApi, 'sendChatMessageWithContext' | 'streamChatMessageWithContext'>
  > {
    return {
      sendChatMessageWithContext: jest.fn().mockResolvedValue(batchResponse),
      streamChatMessageWithContext: jest.fn().mockResolvedValue(streamResponse),
    };
  }

  afterEach(() => {
    if (originalStreamingFlag === undefined) {
      delete process.env.NEXT_AI_CHAT_STREAMING;
    } else {
      process.env.NEXT_AI_CHAT_STREAMING = originalStreamingFlag;
    }
    jest.clearAllMocks();
  });

  it('uses stream API when NEXT_AI_CHAT_STREAMING is unset', async () => {
    delete process.env.NEXT_AI_CHAT_STREAMING;
    const aiApi = createApiMock();
    const service = new AIServiceImpl(aiApi as unknown as EmporixAIApi);

    const result = await service.sendChatMessageWithContext('hello', baseContext);

    expect(aiApi.streamChatMessageWithContext).toHaveBeenCalledTimes(1);
    expect(aiApi.streamChatMessageWithContext).toHaveBeenCalledWith(
      'hello',
      {
        siteId: 'main',
        currency: 'EUR',
        language: 'en',
        sessionId: 'session-1',
      },
      undefined,
    );
    expect(aiApi.sendChatMessageWithContext).not.toHaveBeenCalled();
    expect(result).toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'stream-message',
      sessionId: 'stream-session',
    });
  });

  it("uses batch API only when NEXT_AI_CHAT_STREAMING is 'false'", async () => {
    process.env.NEXT_AI_CHAT_STREAMING = 'false';
    const aiApi = createApiMock();
    const service = new AIServiceImpl(aiApi as unknown as EmporixAIApi);

    const result = await service.sendChatMessageWithContext('hello', {
      ...baseContext,
      cartId: 'cart-123',
    });

    expect(aiApi.sendChatMessageWithContext).toHaveBeenCalledTimes(1);
    expect(aiApi.sendChatMessageWithContext).toHaveBeenCalledWith('hello', {
      siteId: 'main',
      currency: 'EUR',
      language: 'en',
      sessionId: 'session-1',
      cartId: 'cart-123',
    });
    expect(aiApi.streamChatMessageWithContext).not.toHaveBeenCalled();
    expect(result).toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'batch-message',
      sessionId: 'batch-session',
    });
  });
});
