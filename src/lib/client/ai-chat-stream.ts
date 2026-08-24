import {
  type AIChatStreamEvent,
  isAIChatCompleteEvent,
  isAIChatErrorEvent,
  isAIChatProgressEvent,
} from '@/lib/common/ai-chat-stream';
import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import type { AIChatResponse } from '@/platform/integrations/ai/model';

function removeOptionalSpace(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value;
}

function takeCompleteSseBlocks(buffer: string): { blocks: string[]; rest: string } {
  const normalized = buffer.replaceAll('\r\n', '\n');
  const separator = '\n\n';
  const lastSeparator = normalized.lastIndexOf(separator);
  if (lastSeparator === -1) {
    return { blocks: [], rest: normalized };
  }

  const complete = normalized.slice(0, lastSeparator);
  const rest = normalized.slice(lastSeparator + separator.length);
  return {
    blocks: complete.split(separator).filter((block) => block !== ''),
    rest,
  };
}

function payloadFromBlock(block: string): string {
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
}

function parseStreamEvent(payload: string): AIChatStreamEvent | null {
  try {
    const parsed = JSON.parse(payload) as AIChatStreamEvent;
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function readAIChatSseResponse(
  body: ReadableStream<Uint8Array>,
  onProgress?: (progress: AIChatStreamProgressUpdate) => void,
): Promise<AIChatResponse> {
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
}
