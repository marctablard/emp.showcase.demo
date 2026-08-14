/**
 * Observed frames (not a published contract):
 * - event:token `{ content: string }` (live frontendAgent; concatenate)
 * - event:tool_start / event:tool_end `{ tool_name, tool_call_id }` (ignore)
 * - event:done metadata-only identity (no message; overlay identity only)
 * - plain-text token / JSON-string data payloads
 * - one-shot Frontend Agent envelope (`type` / `data`)
 * - published ChatResponse (string `message` + identity, no `type`/`data`)
 *
 * Live frontendAgent capture (showcasedev chat-stream): the reply is the
 * concatenation of token `content` strings, not `event:done`. One stream
 * can concatenate a markdown-fenced tool payload and a later Frontend Agent
 * envelope; the assembler keeps the last widget envelope and drops tool JSON.
 * COP-5591 sibling parser (`emporix/hosting-md-extension`) also emits
 * plain-text tokens + metadata-only frames.
 */
import type { EmporixAIChatResponse } from '../model/ai';

type StreamSource = ReadableStream<Uint8Array> | string;
type StreamObject = Record<string, unknown>;
type StreamIdentity = Pick<EmporixAIChatResponse, 'agentId' | 'agentType' | 'sessionId'>;

const FALLBACK_RESPONSE: StreamIdentity = {
  agentId: 'frontendAgent',
  agentType: 'generic',
  sessionId: '',
};

const EMPTY_IDENTITY: StreamIdentity = {
  agentId: '',
  agentType: '',
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

function hasTokenContent(payload: StreamObject): payload is StreamObject & { content: string } {
  return typeof payload.content === 'string';
}

function mapIdentity(payload: StreamObject): StreamIdentity {
  return {
    agentId: toStringValue(payload.agentId ?? payload.agent_id),
    agentType: toStringValue(payload.agentType ?? payload.agent_type),
    sessionId: toStringValue(payload.sessionId ?? payload.session_id),
  };
}

function mergeIdentity(current: StreamIdentity, incoming: StreamIdentity): StreamIdentity {
  return {
    agentId: incoming.agentId || current.agentId,
    agentType: incoming.agentType || current.agentType,
    sessionId: incoming.sessionId || current.sessionId,
  };
}

function applyIdentityOverlay(response: EmporixAIChatResponse, overlay: StreamIdentity): EmporixAIChatResponse {
  return {
    ...response,
    agentId: response.agentId || overlay.agentId,
    agentType: response.agentType || overlay.agentType,
    sessionId: response.sessionId || overlay.sessionId,
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
  const normalized = rawStream.replaceAll('\r\n', '\n');
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

function isStreamObject(value: unknown): value is StreamObject {
  return value !== null && typeof value === 'object';
}

function consumeJsonStringCharacter(character: string, escaped: boolean): { inString: boolean; escaped: boolean } {
  if (escaped) {
    return { inString: true, escaped: false };
  }
  if (character === '\\') {
    return { inString: true, escaped: true };
  }
  if (character === '"') {
    return { inString: false, escaped: false };
  }
  return { inString: true, escaped: false };
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      ({ inString, escaped } = consumeJsonStringCharacter(character, escaped));
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      depth += 1;
      continue;
    }
    if (character !== '}') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }

  return -1;
}

function pushParsedObject(candidate: string, objects: StreamObject[]): void {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (isStreamObject(parsed)) {
      objects.push(parsed);
    }
  } catch {
    // Candidate is not a complete JSON object.
  }
}

function collectJsonObjectsFromText(text: string, objects: StreamObject[]): void {
  pushParsedObject(text.trim(), objects);

  let index = 0;
  while (index < text.length) {
    const start = text.indexOf('{', index);
    if (start === -1) {
      break;
    }
    const end = findMatchingBrace(text, start);
    if (end === -1) {
      break;
    }
    pushParsedObject(text.slice(start, end + 1), objects);
    index = end + 1;
  }
}

function collectCandidateStreamObjects(textBuffer: string): StreamObject[] {
  const objects: StreamObject[] = [];
  const remainder = textBuffer.replaceAll(/```(?:json)?\r?\n?([\s\S]*?)```/gi, (_match, body: string) => {
    collectJsonObjectsFromText(body, objects);
    return '\n';
  });
  collectJsonObjectsFromText(remainder, objects);
  return objects;
}

function responseFromStreamObject(objectPayload: StreamObject, overlay: StreamIdentity): EmporixAIChatResponse | null {
  if (hasFrontendAgentShape(objectPayload)) {
    return applyIdentityOverlay(createCapturedResponse(objectPayload, JSON.stringify(objectPayload)), overlay);
  }

  if (hasPublishedChatResponseShape(objectPayload)) {
    return applyIdentityOverlay(createCapturedResponse(objectPayload, objectPayload.message), overlay);
  }

  return null;
}

function pickAssembledResponse(objects: StreamObject[], overlay: StreamIdentity): EmporixAIChatResponse | null {
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const assembled = responseFromStreamObject(objects[index], overlay);
    if (assembled) {
      return assembled;
    }
  }

  return null;
}

function responseFromTextBuffer(textBuffer: string, overlay: StreamIdentity): EmporixAIChatResponse {
  const assembled = pickAssembledResponse(collectCandidateStreamObjects(textBuffer), overlay);
  if (assembled) {
    return assembled;
  }

  return {
    agentId: overlay.agentId || FALLBACK_RESPONSE.agentId,
    agentType: overlay.agentType || FALLBACK_RESPONSE.agentType,
    sessionId: overlay.sessionId || FALLBACK_RESPONSE.sessionId,
    message: textBuffer,
  };
}

function assertNonEmptyMessage(response: EmporixAIChatResponse): EmporixAIChatResponse {
  if (response.message === '') {
    throw new Error('AI stream contained an empty message');
  }

  return response;
}

type AssemblyState = {
  textBuffer: string;
  capturedResponse: EmporixAIChatResponse | null;
  identityOverlay: StreamIdentity;
};

function applyObjectPayload(state: AssemblyState, objectPayload: StreamObject): void {
  if (hasFrontendAgentShape(objectPayload)) {
    state.capturedResponse = createCapturedResponse(objectPayload, JSON.stringify(objectPayload));
    return;
  }

  if (hasPublishedChatResponseShape(objectPayload)) {
    state.capturedResponse = createCapturedResponse(objectPayload, objectPayload.message);
    return;
  }

  if (hasTokenContent(objectPayload)) {
    state.textBuffer += objectPayload.content;
    return;
  }

  if (hasIdentityField(objectPayload)) {
    state.identityOverlay = mergeIdentity(state.identityOverlay, mapIdentity(objectPayload));
  }
}

function consumePayload(state: AssemblyState, payload: string): void {
  try {
    const parsed = JSON.parse(payload) as unknown;

    if (typeof parsed === 'string') {
      state.textBuffer += parsed;
      return;
    }

    if (isStreamObject(parsed)) {
      applyObjectPayload(state, parsed);
    }
  } catch {
    state.textBuffer += payload;
  }
}

function finishAssembly(state: AssemblyState): EmporixAIChatResponse {
  if (state.capturedResponse) {
    return assertNonEmptyMessage(applyIdentityOverlay(state.capturedResponse, state.identityOverlay));
  }

  if (state.textBuffer !== '') {
    return assertNonEmptyMessage(responseFromTextBuffer(state.textBuffer, state.identityOverlay));
  }

  throw new Error('AI stream did not contain a message');
}

export async function assembleEmporixChatStream(source: StreamSource): Promise<EmporixAIChatResponse> {
  const rawStream = await readSource(source);
  const payloads = parseEventPayloads(rawStream);
  const state: AssemblyState = {
    textBuffer: '',
    capturedResponse: null,
    identityOverlay: EMPTY_IDENTITY,
  };

  for (const payload of payloads) {
    consumePayload(state, payload);
  }

  return finishAssembly(state);
}
