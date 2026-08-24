import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import type { AIChatResponse } from '@/platform/integrations/ai/model';

export type AIChatProgressEvent = {
  type: 'progress';
} & AIChatStreamProgressUpdate;

export type AIChatCompleteEvent = {
  type: 'complete';
} & AIChatResponse;

export type AIChatErrorEvent = {
  type: 'error';
  code: string;
  error: string;
  retryable?: boolean;
};

export type AIChatStreamEvent = AIChatProgressEvent | AIChatCompleteEvent | AIChatErrorEvent;

export function encodeAiChatSse(event: AIChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function isAIChatProgressEvent(event: AIChatStreamEvent): event is AIChatProgressEvent {
  return event.type === 'progress';
}

export function isAIChatCompleteEvent(event: AIChatStreamEvent): event is AIChatCompleteEvent {
  return event.type === 'complete';
}

export function isAIChatErrorEvent(event: AIChatStreamEvent): event is AIChatErrorEvent {
  return event.type === 'error';
}
