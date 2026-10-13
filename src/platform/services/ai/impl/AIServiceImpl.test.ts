import type { AIChatContext } from '@/platform/integrations/ai/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import type { EmporixAIChatResponse } from '@/platform/integrations/emporix/model/ai';
import type { EmporixOrderApi } from '@/platform/integrations/emporix/order/EmporixOrderApi';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import type { EmporixQuoteApi } from '@/platform/integrations/emporix/quote/EmporixQuoteApi';
import type { EmporixReturnApi } from '@/platform/integrations/emporix/return/EmporixReturnApi';
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

  const orderApi = { getCustomerOrder: jest.fn() };

  function createService(aiApi: ReturnType<typeof createApiMock>): AIServiceImpl {
    return new AIServiceImpl(
      aiApi as unknown as EmporixAIApi,
      orderApi as unknown as EmporixOrderApi,
      { getProduct: jest.fn() } as unknown as EmporixProductApi,
      { getQuote: jest.fn() } as unknown as EmporixQuoteApi,
      { getReturn: jest.fn() } as unknown as EmporixReturnApi,
    );
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
    const service = createService(aiApi);

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
    const service = createService(aiApi);

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

  it('loads orders the agent referenced by ID when the stream carried no tool data', async () => {
    delete process.env.NEXT_AI_CHAT_STREAMING;
    const aiApi = createApiMock();
    aiApi.streamChatMessageWithContext.mockResolvedValue({
      ...streamResponse,
      message: JSON.stringify({ message: 'Here are your orders.', type: 'order_list', data: { orderIds: ['EON1'] } }),
    });
    orderApi.getCustomerOrder.mockResolvedValue({ id: 'EON1', status: 'CREATED', created: '2026-10-09T13:40:36Z' });

    const result = await createService(aiApi).sendChatMessageWithContext('my orders', baseContext);

    expect(orderApi.getCustomerOrder).toHaveBeenCalledWith('EON1');
    const parsed = JSON.parse(result.message);
    expect(parsed.message).toBe('Here are your orders.');
    expect(parsed.data.orders).toEqual([
      expect.objectContaining({ orderId: 'EON1', status: 'CREATED', date: '2026-10-09T13:40:36Z' }),
    ]);
  });
});
