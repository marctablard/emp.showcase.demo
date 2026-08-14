/**
 * Observed frames (not a published contract):
 * - plain-text token
 * - metadata-only
 *
 * Source: COP-5591 sibling parser (`emporix/hosting-md-extension` `agenticChatService`/`sseHelpers`).
 * Live tenant capture was not reachable in this workspace because runtime Emporix credentials are unavailable.
 */
import type { EmporixAIChatResponse } from '../model/ai';

type StreamSource = ReadableStream<Uint8Array> | string;
type StreamObject = Record<string, unknown>;

const FALLBACK_RESPONSE: Pick<EmporixAIChatResponse, 'agentId' | 'agentType' | 'sessionId'> = {
  agentId: 'frontendAgent',
  agentType: 'generic',
  sessionId: '',
};

function removeOptionalSpace(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value;
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function hasFrontendAgentShape(payload: StreamObject): boolean {
  return Object.hasOwn(payload, 'type') || Object.hasOwn(payload, 'data');
}

function hasIdentityField(payload: StreamObject): boolean {
  return (
    Object.hasOwn(payload, 'agentId') ||
    Object.hasOwn(payload, 'agent_id') ||
    Object.hasOwn(payload, 'sessionId') ||
    Object.hasOwn(payload, 'session_id')
  );
}

function hasPublishedChatResponseShape(payload: StreamObject): payload is StreamObject & { message: string } {
  return (
    typeof payload.message === 'string' &&
    hasIdentityField(payload) &&
    !Object.hasOwn(payload, 'type') &&
    !Object.hasOwn(payload, 'data')
  );
}

function mapIdentity(payload: StreamObject): Pick<EmporixAIChatResponse, 'agentId' | 'agentType' | 'sessionId'> {
  return {
    agentId: toStringValue(payload.agentId ?? payload.agent_id),
    agentType: toStringValue(payload.agentType ?? payload.agent_type),
    sessionId: toStringValue(payload.sessionId ?? payload.session_id),
  };
}

function createCapturedResponse(payload: StreamObject, message: string): EmporixAIChatResponse {
  return {
    ...FALLBACK_RESPONSE,
    ...mapIdentity(payload),
    message,
  };
}

function parseEventPayloads(rawStream: string): string[] {
  const normalized = rawStream.replace(/\r\n/g, '\n');
  const events = normalized.split('\n\n');
  const payloads: string[] = [];

  for (const eventBlock of events) {
    const dataLines: string[] = [];
    const lines = eventBlock.split('\n');

    for (const line of lines) {
      if (!line || line.startsWith(':')) {
        continue;
      }

      if (line.startsWith('data:')) {
        dataLines.push(removeOptionalSpace(line.slice(5)));
      }
    }

    const eventPayload = dataLines.join('\n');
    if (eventPayload !== '') {
      payloads.push(eventPayload);
    }
  }

  return payloads;
}

async function readSource(source: StreamSource): Promise<string> {
  if (typeof source === 'string') {
    return source;
  }

  const reader = source.getReader();
  const decoder = new TextDecoder();
  let rawStream = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      rawStream += decoder.decode();
      break;
    }

    rawStream += decoder.decode(value, { stream: true });
  }

  return rawStream;
}

export async function assembleEmporixChatStream(source: StreamSource): Promise<EmporixAIChatResponse> {
  const rawStream = await readSource(source);
  const payloads = parseEventPayloads(rawStream);

  let textBuffer = '';
  let capturedResponse: EmporixAIChatResponse | null = null;

  for (const payload of payloads) {
    try {
      const parsed = JSON.parse(payload) as unknown;

      if (typeof parsed === 'string') {
        textBuffer += parsed;
        continue;
      }

      if (!parsed || typeof parsed !== 'object') {
        continue;
      }

      const objectPayload = parsed as StreamObject;

      if (hasFrontendAgentShape(objectPayload)) {
        capturedResponse = createCapturedResponse(objectPayload, JSON.stringify(objectPayload));
        continue;
      }

      if (hasPublishedChatResponseShape(objectPayload)) {
        capturedResponse = createCapturedResponse(objectPayload, objectPayload.message);
      }
    } catch {
      textBuffer += payload;
    }
  }

  if (capturedResponse) {
    if (capturedResponse.message === '') {
      throw new Error('AI stream contained an empty message');
    }

    return capturedResponse;
  }

  if (textBuffer !== '') {
    return {
      ...FALLBACK_RESPONSE,
      message: textBuffer,
    };
  }

  throw new Error('AI stream did not contain a message');
}
