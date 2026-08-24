/**
 * Observed frames (not a published contract):
 * - event:token `{ content: string }` (live frontendAgent; concatenate)
 * - event:tool_start `{ tool_name, tool_call_id }` (skeleton widget from tool name)
 * - event:tool_result `{ tool_name, tool_call_id, output }` (fill widget from JSON)
 * - event:thinking `{ content }` (upstream CoT; progress forwards opaque `thinking: "active"` only — never raw text)
 * - event:tool_end `{ tool_name, tool_call_id }`
 * - event:done metadata-only identity (no message; overlay identity only)
 * - plain-text token / JSON-string data payloads
 * - one-shot Frontend Agent envelope (`type` / `data`)
 * - published ChatResponse (string `message` + identity, no `type`/`data`)
 *
 * Live frontendAgent capture (showcasedev chat-stream): the reply is the
 * concatenation of token `content` strings, not `event:done`. One stream
 * can concatenate a markdown-fenced tool payload and a later Frontend Agent
 * envelope; the assembler keeps the last widget envelope and drops tool JSON.
 * Optional `onProgress` reports each upstream SSE frame with a shopper-visible
 * preview (plain text, HTML, or a typed widget from `tool_start` / `tool_result`).
 * Token JSON widgets paint as soon as `type`/`data` are available; tool results
 * win and appear as soon as the tool returns. `tool_start` shows a typed skeleton.
 * Thinking progress is an opaque status flag only (never raw chain-of-thought).
 * COP-5591 sibling parser (`emporix/hosting-md-extension`) also emits
 * plain-text tokens + metadata-only frames.
 */
import {
  type AIChatStreamProgressUpdate,
  type StreamPreview,
  WIDGET_TYPES,
  previewStreamingAIMessage,
  sanitizeShopperCaption,
  toStreamProgressUpdate,
} from '@/lib/common/ai-stream-preview';
import { adaptToolResult, widgetHasItems, widgetTypeFromToolName } from '@/lib/common/ai-tool-widgets';
import { findMatchingBrace } from '@/lib/common/json-brace-scan';
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

/** Opaque shopper-facing marker — never the raw model thinking text. */
const SHOPPER_THINKING_STATUS = 'active';

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
  const identity = mapIdentity(payload);
  return {
    agentId: identity.agentId || FALLBACK_RESPONSE.agentId,
    agentType: identity.agentType || FALLBACK_RESPONSE.agentType,
    sessionId: identity.sessionId || FALLBACK_RESPONSE.sessionId,
    message,
  };
}

type SseFrame = {
  eventName: string;
  payload: string;
};

type WidgetState = {
  type: string;
  data: Record<string, unknown>;
};

function parseEventFrames(rawStream: string): SseFrame[] {
  const normalized = rawStream.replaceAll('\r\n', '\n');
  const events = normalized.split('\n\n');
  const frames: SseFrame[] = [];

  for (const eventBlock of events) {
    const dataLines: string[] = [];
    let eventName = '';
    const lines = eventBlock.split('\n');

    for (const line of lines) {
      if (!line || line.startsWith(':')) {
        continue;
      }

      if (line.startsWith('event:')) {
        eventName = removeOptionalSpace(line.slice(6));
        continue;
      }

      if (line.startsWith('data:')) {
        dataLines.push(removeOptionalSpace(line.slice(5)));
      }
    }

    const eventPayload = dataLines.join('\n');
    if (eventPayload !== '') {
      frames.push({ eventName, payload: eventPayload });
    }
  }

  return frames;
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

function framesFromBlocks(blocks: string[]): SseFrame[] {
  const frames: SseFrame[] = [];
  for (const block of blocks) {
    frames.push(...parseEventFrames(`${block}\n\n`));
  }
  return frames;
}

function createAssemblyState(): AssemblyState {
  return {
    textBuffer: '',
    capturedResponse: null,
    identityOverlay: EMPTY_IDENTITY,
    widget: null,
    pendingWidget: null,
    thinking: '',
  };
}

export type ChatStreamProgressHandler = (progress: AIChatStreamProgressUpdate) => void;

function previewFromAssemblyState(state: AssemblyState): StreamPreview {
  const tokenPreview = tokenPreviewFromState(state);
  const tokenIntro = captionFromPreview(tokenPreview);
  const resolved = resolvedWidget(state, tokenPreview);

  if (resolved && WIDGET_TYPES.has(resolved.type)) {
    return {
      kind: 'widget',
      type: resolved.type,
      message: tokenIntro,
      data: resolved.data,
    };
  }

  if (state.pendingWidget && WIDGET_TYPES.has(state.pendingWidget)) {
    const data =
      tokenPreview.kind === 'widget' && tokenPreview.type === state.pendingWidget
        ? (tokenPreview.data as Record<string, unknown>)
        : {};
    return {
      kind: 'widget',
      type: state.pendingWidget,
      message: tokenIntro,
      data,
    };
  }

  return tokenPreview;
}

function tokenPreviewFromState(state: AssemblyState): StreamPreview {
  const raw = state.capturedResponse?.message ?? state.textBuffer;
  if (!raw) {
    return { kind: 'pending' };
  }
  return previewStreamingAIMessage(raw);
}

function captionFromPreview(preview: StreamPreview): string {
  if (preview.kind === 'text') {
    return sanitizeShopperCaption(preview.content);
  }
  if (preview.kind === 'widget') {
    return sanitizeShopperCaption(preview.message);
  }
  return '';
}

function tokenIntroFromState(state: AssemblyState): string {
  return captionFromPreview(tokenPreviewFromState(state));
}

function consumeFrames(
  state: AssemblyState,
  frames: SseFrame[],
  onProgress: ChatStreamProgressHandler | undefined,
  startCount: number,
): number {
  let chunks = startCount;
  let lastPreview: StreamPreview | undefined;
  for (const frame of frames) {
    consumeFrame(state, frame);
    chunks += 1;
    const forcePreview =
      frame.eventName === 'tool_start' ||
      frame.eventName === 'tool_result' ||
      frame.eventName === 'thinking' ||
      frame.eventName === 'done';
    // Coalesce token-only frames once a shopper-visible preview exists. Never
    // freeze on `pending` — that blocks widgets/HTML as the envelope completes.
    const canReusePreview = lastPreview != null && lastPreview.kind !== 'pending' && chunks % 4 !== 0;
    if (!forcePreview && canReusePreview) {
      onProgress?.(toStreamProgressUpdate(chunks, lastPreview, state.thinking ? SHOPPER_THINKING_STATUS : undefined));
      continue;
    }
    lastPreview = previewFromAssemblyState(state);
    onProgress?.(toStreamProgressUpdate(chunks, lastPreview, state.thinking ? SHOPPER_THINKING_STATUS : undefined));
  }
  return chunks;
}

async function assembleFromReadableStream(
  source: ReadableStream<Uint8Array>,
  onProgress?: ChatStreamProgressHandler,
): Promise<EmporixAIChatResponse> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  const state = createAssemblyState();
  let buffer = '';
  let chunks = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const { blocks, rest } = takeCompleteSseBlocks(buffer);
    buffer = rest;
    chunks = consumeFrames(state, framesFromBlocks(blocks), onProgress, chunks);
  }

  if (buffer !== '') {
    consumeFrames(state, parseEventFrames(buffer), onProgress, chunks);
  }

  return finishAssembly(state);
}

function isStreamObject(value: unknown): value is StreamObject {
  return value !== null && typeof value === 'object';
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

function sanitizeCompletedMessage(message: string): string {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (isStreamObject(parsed) && typeof parsed.message === 'string') {
      return JSON.stringify({
        ...parsed,
        message: sanitizeShopperCaption(parsed.message),
      });
    }
  } catch {
    // Plain-text completion — filter planning / CoT markdown the same as live preview.
  }
  return sanitizeShopperCaption(message);
}

function withSanitizedCompletion(response: EmporixAIChatResponse): EmporixAIChatResponse {
  const sanitized = sanitizeCompletedMessage(response.message);
  if (sanitized === response.message) {
    return response;
  }
  // Keep original when sanitizer empties a non-JSON body so assertNonEmptyMessage can still pass
  // only for real shopper text; pure planning leaks become empty and fail closed.
  if (sanitized === '' && !response.message.trimStart().startsWith('{')) {
    return { ...response, message: sanitized };
  }
  if (sanitized === '') {
    return response;
  }
  return { ...response, message: sanitized };
}

function responseFromTextBuffer(textBuffer: string, overlay: StreamIdentity): EmporixAIChatResponse {
  const assembled = pickAssembledResponse(collectCandidateStreamObjects(textBuffer), overlay);
  if (assembled) {
    return withSanitizedCompletion(assembled);
  }

  return withSanitizedCompletion({
    agentId: overlay.agentId || FALLBACK_RESPONSE.agentId,
    agentType: overlay.agentType || FALLBACK_RESPONSE.agentType,
    sessionId: overlay.sessionId || FALLBACK_RESPONSE.sessionId,
    message: textBuffer,
  });
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
  widget: WidgetState | null;
  pendingWidget: string | null;
  thinking: string;
};

function consumeFrame(state: AssemblyState, frame: SseFrame): void {
  if (frame.eventName === 'thinking') {
    consumeThinking(state, frame.payload);
    return;
  }

  if (frame.eventName === 'tool_result') {
    consumeToolResult(state, frame.payload);
    return;
  }

  if (
    frame.eventName === 'tool_start' ||
    frame.eventName === 'tool_end' ||
    frame.eventName === 'done' ||
    frame.eventName === 'error'
  ) {
    if (frame.eventName === 'tool_start') {
      consumeToolStart(state, frame.payload);
      return;
    }
    if (frame.eventName === 'done') {
      consumeIdentityOnly(state, frame.payload);
    }
    return;
  }

  consumePayload(state, frame.payload);
}

function consumeThinking(state: AssemblyState, payload: string): void {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (isStreamObject(parsed)) {
      state.thinking += toStringValue(parsed.content);
    }
  } catch {
    // Thinking frames must be JSON.
  }
}

function consumeToolResult(state: AssemblyState, payload: string): void {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isStreamObject(parsed)) {
      return;
    }
    const adapted = adaptToolResult(toStringValue(parsed.tool_name), parsed.output);
    if (!adapted) {
      return;
    }
    state.pendingWidget = adapted.type;
    if (!widgetHasItems(adapted.data)) {
      return;
    }
    state.widget = adapted;
  } catch {
    // Tool results must be JSON.
  }
}

function consumeToolStart(state: AssemblyState, payload: string): void {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isStreamObject(parsed)) {
      return;
    }
    if (hasIdentityField(parsed)) {
      state.identityOverlay = mergeIdentity(state.identityOverlay, mapIdentity(parsed));
    }
    const type = widgetTypeFromToolName(toStringValue(parsed.tool_name));
    if (type) {
      state.pendingWidget = type;
    }
  } catch {
    // Tool metadata is optional.
  }
}

function consumeIdentityOnly(state: AssemblyState, payload: string): void {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (isStreamObject(parsed) && hasIdentityField(parsed)) {
      state.identityOverlay = mergeIdentity(state.identityOverlay, mapIdentity(parsed));
    }
  } catch {
    // Identity overlay is optional.
  }
}

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

function tokenWidgetData(tokenPreview: StreamPreview, type: string): Record<string, unknown> | undefined {
  if (tokenPreview.kind !== 'widget' || tokenPreview.type !== type || !isStreamObject(tokenPreview.data)) {
    return undefined;
  }
  return tokenPreview.data;
}

function resolvedWidget(state: AssemblyState, tokenPreview = tokenPreviewFromState(state)): WidgetState | null {
  const tokenDataForPending = state.pendingWidget ? tokenWidgetData(tokenPreview, state.pendingWidget) : undefined;
  if (!state.widget || !WIDGET_TYPES.has(state.widget.type)) {
    if (state.pendingWidget && tokenDataForPending && widgetHasItems(tokenDataForPending)) {
      return { type: state.pendingWidget, data: tokenDataForPending };
    }
    return null;
  }
  const tokenData = tokenWidgetData(tokenPreview, state.widget.type);
  return { type: state.widget.type, data: pickRicherWidgetData(state.widget.data, tokenData) };
}

function pickRicherWidgetData(
  toolData: Record<string, unknown>,
  tokenData: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!tokenData || !widgetHasItems(tokenData)) {
    return toolData;
  }
  if (!widgetHasItems(toolData)) {
    return tokenData;
  }
  return toolData;
}

function envelopeSize(value: unknown): number {
  try {
    return JSON.stringify(value ?? {}).length;
  } catch {
    return 0;
  }
}

function responseFromWidgetState(state: AssemblyState, widget: WidgetState): EmporixAIChatResponse {
  return applyIdentityOverlay(
    {
      agentId: state.identityOverlay.agentId || FALLBACK_RESPONSE.agentId,
      agentType: state.identityOverlay.agentType || FALLBACK_RESPONSE.agentType,
      sessionId: state.identityOverlay.sessionId || FALLBACK_RESPONSE.sessionId,
      message: JSON.stringify({
        message: tokenIntroFromState(state),
        type: widget.type,
        data: widget.data,
      }),
    },
    state.identityOverlay,
  );
}

function responseFromResolvedWidget(state: AssemblyState): EmporixAIChatResponse | null {
  const widget = resolvedWidget(state);
  if (!widget || !WIDGET_TYPES.has(widget.type) || !widgetHasItems(widget.data)) {
    return null;
  }
  return responseFromWidgetState(state, widget);
}

function responseFromTokenEnvelope(state: AssemblyState): EmporixAIChatResponse | null {
  if (state.capturedResponse) {
    const captured = applyIdentityOverlay(state.capturedResponse, state.identityOverlay);
    if (envelopeDataScore(captured) > 0) {
      return captured;
    }
  }
  if (state.textBuffer === '') {
    return null;
  }
  return pickAssembledResponse(collectCandidateStreamObjects(state.textBuffer), state.identityOverlay);
}

function envelopeDataScore(response: EmporixAIChatResponse): number {
  try {
    const parsed = JSON.parse(response.message) as unknown;
    if (isStreamObject(parsed) && parsed.data != null) {
      return envelopeSize(parsed.data);
    }
  } catch {
    // Plain-text complete messages have no widget payload.
  }
  return 0;
}

function hasFrontendAgentMetadata(response: EmporixAIChatResponse): boolean {
  try {
    const parsed = JSON.parse(response.message) as unknown;
    if (!isStreamObject(parsed)) {
      return false;
    }
    return typeof parsed.agentId === 'string' || typeof parsed.sessionId === 'string';
  } catch {
    return false;
  }
}

function pickRicherResponse(
  fromWidget: EmporixAIChatResponse | null,
  fromTokens: EmporixAIChatResponse | null,
): EmporixAIChatResponse | null {
  if (!fromWidget) {
    return fromTokens;
  }
  if (!fromTokens) {
    return fromWidget;
  }
  const tokenScore = envelopeDataScore(fromTokens);
  const widgetScore = envelopeDataScore(fromWidget);
  if (tokenScore > 0 && hasFrontendAgentMetadata(fromTokens)) {
    return fromTokens;
  }
  if (widgetScore > 0) {
    return fromWidget;
  }
  if (tokenScore > 0) {
    return fromTokens;
  }
  return fromWidget;
}

function finishAssembly(state: AssemblyState): EmporixAIChatResponse {
  const chosen = pickRicherResponse(responseFromResolvedWidget(state), responseFromTokenEnvelope(state));
  if (chosen) {
    return assertNonEmptyMessage(withSanitizedCompletion(chosen));
  }

  if (state.capturedResponse) {
    return assertNonEmptyMessage(
      withSanitizedCompletion(applyIdentityOverlay(state.capturedResponse, state.identityOverlay)),
    );
  }

  if (state.textBuffer !== '') {
    return assertNonEmptyMessage(responseFromTextBuffer(state.textBuffer, state.identityOverlay));
  }

  throw new Error('AI stream did not contain a message');
}

export async function assembleEmporixChatStream(
  source: StreamSource,
  onProgress?: ChatStreamProgressHandler,
): Promise<EmporixAIChatResponse> {
  if (typeof source !== 'string') {
    return assembleFromReadableStream(source, onProgress);
  }

  const state = createAssemblyState();
  consumeFrames(state, parseEventFrames(source), onProgress, 0);
  return finishAssembly(state);
}
