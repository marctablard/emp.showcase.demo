import {
  type AIChatStreamEvent,
  isAIChatCompleteEvent,
  isAIChatErrorEvent,
  isAIChatProgressEvent,
} from '@/lib/common/ai-chat-stream';
import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import { removeOptionalSpace, takeCompleteSseBlocks } from '@/lib/common/sse-framing';
import type { AIChatResponse } from '@/platform/integrations/ai/model';

const payloadFromBlock = (block: string): string => {
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(removeOptionalSpace(line.slice(5)));
    }
  }
  return dataLines.join('\n');
};

const parseStreamEvent = (payload: string): AIChatStreamEvent | null => {
  try {
    const parsed = JSON.parse(payload) as AIChatStreamEvent;
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

export const readAIChatSseResponse = async (
  body: ReadableStream<Uint8Array>,
  onProgress?: (progress: AIChatStreamProgressUpdate) => void,
): Promise<AIChatResponse> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let complete: AIChatResponse | null = null;

  const consumeBlocks = (blocks: string[]) => {
    for (const block of blocks) {
      const payload = payloadFromBlock(block);
      if (payload === '') {
        continue;
      }
      const event = parseStreamEvent(payload);
      if (!event) {
        continue;
      }
      if (isAIChatProgressEvent(event)) {
        onProgress?.({ chunks: event.chunks, preview: event.preview, thinking: event.thinking });
        continue;
      }
      if (isAIChatErrorEvent(event)) {
        throw new Error(event.error);
      }
      if (isAIChatCompleteEvent(event)) {
        complete = {
          agentId: event.agentId,
          agentType: event.agentType,
          message: event.message,
          sessionId: event.sessionId,
          cartRefresh: event.cartRefresh,
        };
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const { blocks, rest } = takeCompleteSseBlocks(buffer);
    buffer = rest;
    consumeBlocks(blocks);
  }

  if (buffer !== '') {
    consumeBlocks([buffer]);
  }

  if (!complete) {
    throw new Error('AI stream did not contain a message');
  }

  return complete;
};
