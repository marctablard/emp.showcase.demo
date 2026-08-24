import { act, renderHook, waitFor } from '@testing-library/react';
import { sendAIChatMessageWithContext } from '@/lib/client/ai';
import { useAI } from './useAI';

jest.mock('@/lib/client/ai', () => ({
  sendAIChatMessageWithContext: jest.fn(),
}));

const mockSendAIChatMessageWithContext = sendAIChatMessageWithContext as jest.Mock;

describe('useAI hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading false and no error', () => {
    const { result } = renderHook(() => useAI());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set loading state during request', async () => {
    mockSendAIChatMessageWithContext.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ message: 'response' }), 100)),
    );

    const { result } = renderHook(() => useAI());
    expect(result.current.loading).toBe(false);

    act(() => {
      result.current.sendMessageWithContext('test', { siteId: 'test', currency: 'USD', language: 'en' });
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should return response from API', async () => {
    const mockResponse = { message: 'Hello from AI' };
    mockSendAIChatMessageWithContext.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAI());

    let response;
    await act(async () => {
      response = await result.current.sendMessageWithContext('test', {
        siteId: 'test',
        currency: 'USD',
        language: 'en',
      });
    });

    expect(response).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('API failed');
    mockSendAIChatMessageWithContext.mockRejectedValue(error);

    const { result } = renderHook(() => useAI());

    await act(async () => {
      try {
        await result.current.sendMessageWithContext('test', { siteId: 'test', currency: 'USD', language: 'en' });
      } catch {
        // Expected error
      }
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.loading).toBe(false);
  });

  it('should reset error on new request', async () => {
    const error = new Error('API failed');
    mockSendAIChatMessageWithContext.mockRejectedValueOnce(error);
    mockSendAIChatMessageWithContext.mockResolvedValueOnce({ message: 'Success' });

    const { result } = renderHook(() => useAI());

    // First request fails
    await act(async () => {
      try {
        await result.current.sendMessageWithContext('test', { siteId: 'test', currency: 'USD', language: 'en' });
      } catch {
        // Expected error
      }
    });

    expect(result.current.error).toEqual(error);

    // Second request succeeds - error should be cleared
    await act(async () => {
      await result.current.sendMessageWithContext('test2', { siteId: 'test', currency: 'USD', language: 'en' });
    });

    expect(result.current.error).toBeNull();
  });

  it('should pass correct parameters to API', async () => {
    mockSendAIChatMessageWithContext.mockResolvedValue({ message: 'response' });

    const { result } = renderHook(() => useAI());

    const context = {
      siteId: 'test-site',
      currency: 'EUR',
      language: 'de',
      cartId: 'cart-123',
    };

    await act(async () => {
      await result.current.sendMessageWithContext('Hello', context);
    });

    expect(mockSendAIChatMessageWithContext).toHaveBeenCalledWith('Hello', context, expect.any(Function));
  });

  it('should expose chunkCount and streamingPreview from stream progress', async () => {
    let resolveRequest: ((value: { message: string }) => void) | undefined;
    mockSendAIChatMessageWithContext.mockImplementation(
      async (
        _message: string,
        _context: unknown,
        onProgress?: (progress: { chunks: number; preview?: { kind: 'text'; content: string } }) => void,
      ) => {
        onProgress?.({ chunks: 0 });
        onProgress?.({ chunks: 7, preview: { kind: 'text', content: 'Typing' } });
        return new Promise((resolve) => {
          resolveRequest = resolve;
        });
      },
    );

    const { result } = renderHook(() => useAI());

    act(() => {
      void result.current.sendMessageWithContext('Hello', { siteId: 'test', currency: 'EUR', language: 'en' });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
      expect(result.current.chunkCount).toBe(7);
      expect(result.current.streamingPreview).toEqual({ kind: 'text', content: 'Typing' });
    });

    await act(async () => {
      resolveRequest?.({ message: 'streamed' });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.chunkCount).toBeNull();
      expect(result.current.streamingPreview).toBeNull();
    });
  });

  it('should expose widget preview and thinking from stream progress', async () => {
    let resolveRequest: ((value: { message: string }) => void) | undefined;
    mockSendAIChatMessageWithContext.mockImplementation(
      async (
        _message: string,
        _context: unknown,
        onProgress?: (progress: {
          chunks: number;
          preview?: { kind: 'widget'; type: string; message: string; data: unknown };
          thinking?: string;
        }) => void,
      ) => {
        onProgress?.({
          chunks: 2,
          thinking: 'active',
          preview: {
            kind: 'widget',
            type: 'quote_list',
            message: '',
            data: {},
          },
        });
        return new Promise((resolve) => {
          resolveRequest = resolve;
        });
      },
    );

    const { result } = renderHook(() => useAI());

    act(() => {
      void result.current.sendMessageWithContext('Hello', { siteId: 'test', currency: 'EUR', language: 'en' });
    });

    await waitFor(() => {
      expect(result.current.streamingThinking).toBe('active');
      expect(result.current.streamingPreview).toEqual({
        kind: 'widget',
        type: 'quote_list',
        message: '',
        data: {},
      });
    });

    await act(async () => {
      resolveRequest?.({ message: 'streamed' });
    });
  });
});
