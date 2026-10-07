import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import type { EmporixAIChatContext, EmporixAIChatResponse } from '../model/ai';
import { assembleEmporixChatStream } from './assembleEmporixChatStream';
import EmporixAIApi from './impl/EmporixAIApi';

jest.mock('./assembleEmporixChatStream', () => ({
  assembleEmporixChatStream: jest.fn(),
}));

const mockConfig: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'test-tenant',
  clientId: 'test-client-id',
  clientSecret: '',
  serverClientId: '',
  serverClientSecret: '',
};

const chatContext: EmporixAIChatContext = {
  siteId: 'main',
  language: 'en',
  currency: 'USD',
  sessionId: 'session-123',
};

const mockedAssembleEmporixChatStream = jest.mocked(assembleEmporixChatStream);

function createBodyStream(payload: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
}

describe('EmporixAIApi.streamChatMessageWithContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls chat-stream endpoint with SSE headers and assembles response body', async () => {
    const responseJson = jest.fn();
    const streamBody = createBodyStream('data: "stream-content"\n\n');
    const expectedResponse: EmporixAIChatResponse = {
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'stream-content',
      sessionId: 'session-123',
    };
    mockedAssembleEmporixChatStream.mockResolvedValue(expectedResponse);

    const mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: streamBody,
        json: responseJson,
      } as unknown as Response),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    const api = new EmporixAIApi(mockApiClient, mockConfig);

    const result = await api.streamChatMessageWithContext('Show my profile', chatContext);

    expect(result).toEqual(expectedResponse);
    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledWith(
      '/ai-service/test-tenant/agentic/chat-stream',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'session-id': 'session-123',
        }),
      }),
      'ai',
      undefined,
      {
        source: 'ai',
        routePattern: '/ai-service/{tenant}/agentic/chat-stream',
      },
    );

    const fetchBody = (mockApiClient.authenticatedFetch.mock.calls[0][1] as RequestInit).body as string;
    expect(JSON.parse(fetchBody)).toEqual({
      agentId: 'frontendAgent',
      message: JSON.stringify({
        userMessage: 'Show my profile',
        context: chatContext,
      }),
    });

    expect(mockedAssembleEmporixChatStream).toHaveBeenCalledWith(streamBody, undefined);
    expect(responseJson).not.toHaveBeenCalled();
  });

  it('throws when upstream stream request is non-OK', async () => {
    const mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      } as unknown as Response),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    const api = new EmporixAIApi(mockApiClient, mockConfig);

    await expect(api.streamChatMessageWithContext('Show my orders', chatContext)).rejects.toThrow(
      'Failed to send chat message: Emporix AI service request failed: 502 Bad Gateway',
    );
    expect(mockedAssembleEmporixChatStream).not.toHaveBeenCalled();
  });

  it('throws when stream response body is missing', async () => {
    const mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: null,
      } as unknown as Response),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    const api = new EmporixAIApi(mockApiClient, mockConfig);

    await expect(api.streamChatMessageWithContext('Show my pending orders', chatContext)).rejects.toThrow(
      'Failed to send chat message: Emporix AI service stream response body is missing',
    );
    expect(mockedAssembleEmporixChatStream).not.toHaveBeenCalled();
  });

  it('wraps stream assembly failures with a consistent error message', async () => {
    mockedAssembleEmporixChatStream.mockRejectedValue(new Error('Empty stream'));

    const mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: createBodyStream('data: "stream-content"\n\n'),
      } as unknown as Response),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    const api = new EmporixAIApi(mockApiClient, mockConfig);

    await expect(api.streamChatMessageWithContext('Show my profile', chatContext)).rejects.toThrow(
      'Failed to send chat message: Empty stream',
    );
  });
});
