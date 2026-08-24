import { encodeAiChatSse } from '@/lib/common/ai-chat-stream';
import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import { readAIChatSseResponse } from './ai-chat-stream';

function sseStream(events: Parameters<typeof encodeAiChatSse>[0][]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) {
        controller.enqueue(encoder.encode(encodeAiChatSse(event)));
      }
      controller.close();
    },
  });
}

describe('readAIChatSseResponse', () => {
  it('reports progress then returns the complete response', async () => {
    const progressUpdates: Array<{ chunks: number; preview?: { kind: string; content: string } }> = [];
    const body = sseStream([
      { type: 'progress', chunks: 0 },
      { type: 'progress', chunks: 3, preview: { kind: 'text', content: 'don' } },
      {
        type: 'complete',
        agentId: 'frontendAgent',
        agentType: 'generic',
        message: 'done',
        sessionId: 'session-1',
      },
    ]);

    const result = await readAIChatSseResponse(body, (progress) => {
      progressUpdates.push(progress as { chunks: number; preview?: { kind: string; content: string } });
    });

    expect(progressUpdates).toEqual([{ chunks: 0 }, { chunks: 3, preview: { kind: 'text', content: 'don' } }]);
    expect(result).toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'done',
      sessionId: 'session-1',
    });
  });

  it('forwards thinking on progress events', async () => {
    const progressUpdates: AIChatStreamProgressUpdate[] = [];
    const body = sseStream([
      {
        type: 'progress',
        chunks: 2,
        thinking: 'Looking up orders.',
        preview: {
          kind: 'widget',
          type: 'order_list',
          message: 'Here are your orders.',
          data: { orders: [{ orderId: 'EON1' }] },
        },
      },
      {
        type: 'complete',
        agentId: 'frontendAgent',
        agentType: 'generic',
        message: 'done',
        sessionId: 'session-1',
      },
    ]);

    await readAIChatSseResponse(body, (progress) => {
      progressUpdates.push(progress);
    });

    expect(progressUpdates).toEqual([
      {
        chunks: 2,
        thinking: 'Looking up orders.',
        preview: {
          kind: 'widget',
          type: 'order_list',
          message: 'Here are your orders.',
          data: { orders: [{ orderId: 'EON1' }] },
        },
      },
    ]);
  });

  it('throws when the stream sends an error event', async () => {
    const body = sseStream([
      { type: 'progress', chunks: 1 },
      { type: 'error', code: 'AI_SERVICE_ERROR', error: 'Failed to process AI chat request' },
    ]);

    await expect(readAIChatSseResponse(body)).rejects.toThrow('Failed to process AI chat request');
  });
});
