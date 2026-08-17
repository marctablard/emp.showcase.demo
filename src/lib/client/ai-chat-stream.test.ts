import { encodeAiChatSse } from '@/lib/common/ai-chat-stream';
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
    const counts: number[] = [];
    const body = sseStream([
      { type: 'progress', chunks: 0 },
      { type: 'progress', chunks: 3 },
      {
        type: 'complete',
        agentId: 'frontendAgent',
        agentType: 'generic',
        message: 'done',
        sessionId: 'session-1',
      },
    ]);

    const result = await readAIChatSseResponse(body, (chunks) => {
      counts.push(chunks);
    });

    expect(counts).toEqual([0, 3]);
    expect(result).toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'done',
      sessionId: 'session-1',
    });
  });

  it('throws when the stream sends an error event', async () => {
    const body = sseStream([
      { type: 'progress', chunks: 1 },
      { type: 'error', code: 'AI_SERVICE_ERROR', error: 'Failed to process AI chat request' },
    ]);

    await expect(readAIChatSseResponse(body)).rejects.toThrow('Failed to process AI chat request');
  });
});
