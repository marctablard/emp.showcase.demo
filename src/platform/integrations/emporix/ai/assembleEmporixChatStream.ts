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
 * Sibling parser (`emporix/hosting-md-extension`) also emits
 * plain-text tokens + metadata-only frames.
 */
import {
  type AIChatStreamProgressUpdate,
  type StreamPreview,
  WIDGET_TYPES,
  previewStreamingAIMessage,
  sanitizeCompletedShopperText,
  sanitizeShopperCaption,
  toStreamProgressUpdate,
} from '@/lib/common/ai-stream-preview';
import { adaptToolResult, widgetHasItems, widgetTypeFromToolName } from '@/lib/common/ai-tool-widgets';
import { findMatchingBrace } from '@/lib/common/json-brace-scan';
import { removeOptionalSpace, takeCompleteSseBlocks } from '@/lib/common/sse-framing';
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

function withFallbackIdentity(response: EmporixAIChatResponse): EmporixAIChatResponse {
  return {
    ...response,
    agentId: response.agentId || FALLBACK_RESPONSE.agentId,
    agentType: response.agentType || FALLBACK_RESPONSE.agentType,
    sessionId: response.sessionId || FALLBACK_RESPONSE.sessionId,
  };
}

function createCapturedResponse(payload: StreamObject, message: string): EmporixAIChatResponse {
  const identity = mapIdentity(payload);
  return {
    agentId: identity.agentId,
    agentType: identity.agentType,
    sessionId: identity.sessionId,
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
    widgetsByType: new Map(),
    pendingWidget: null,
    thinking: false,
    cachedPreviewSource: '',
    cachedTokenPreview: null,
  };
}

export type ChatStreamProgressHandler = (progress: AIChatStreamProgressUpdate) => void;

/**
 * Tools are often context lookups (customer rules, owned products) before the tool that feeds the
 * answer, so no card is painted until the agent's envelope declares its widget type.
 */
function previewFromAssemblyState(state: AssemblyState): StreamPreview {
  const tokenPreview = tokenPreviewFromState(state);
  if (tokenPreview.kind !== 'widget') {
    return tokenPreview;
  }
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

  return tokenPreview;
}

function tokenPreviewFromState(state: AssemblyState): StreamPreview {
  const raw = state.capturedResponse?.message ?? state.textBuffer;
  if (!raw) {
    return { kind: 'pending' };
  }
  if (state.cachedPreviewSource === raw && state.cachedTokenPreview != null) {
    return state.cachedTokenPreview;
  }
  const preview = previewStreamingAIMessage(raw);
  state.cachedPreviewSource = raw;
  state.cachedTokenPreview = preview;
  return preview;
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
      // Omit preview payload — useAI keeps the last preview; avoids re-serializing large widgets.
      onProgress?.(
        toStreamProgressUpdate(chunks, { kind: 'pending' }, state.thinking ? SHOPPER_THINKING_STATUS : undefined),
      );
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

function sanitizeCompletedEnvelopeData(data: unknown): unknown {
  if (!isStreamObject(data)) {
    return data;
  }
  if (typeof data.message !== 'string') {
    return data;
  }
  return {
    ...data,
    message: sanitizeCompletedShopperText(data.message),
  };
}

function sanitizeCompletedMessage(message: string): string {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (isStreamObject(parsed)) {
      const next: StreamObject = { ...parsed };
      if (typeof next.message === 'string') {
        next.message = sanitizeCompletedShopperText(next.message);
      }
      if (next.data != null) {
        next.data = sanitizeCompletedEnvelopeData(next.data);
      }
      return JSON.stringify(next);
    }
  } catch {
    // Plain-text completion — filter planning / CoT without the live caption length cap.
  }
  return sanitizeCompletedShopperText(message);
}

function envelopeHasMeaningfulWidget(parsed: StreamObject): boolean {
  const type = typeof parsed.type === 'string' ? parsed.type : '';
  if (!type || type === 'text') {
    return false;
  }
  if (type === 'html') {
    return isStreamObject(parsed.data) && typeof parsed.data.html === 'string' && parsed.data.html !== '';
  }
  if (type === 'error') {
    if (!isStreamObject(parsed.data)) {
      return false;
    }
    const errorData: StreamObject = parsed.data;
    for (const key of ['message', 'details', 'errorCode'] as const) {
      const value = errorData[key];
      if (typeof value === 'string' && value !== '') {
        return true;
      }
    }
    return false;
  }
  if (!WIDGET_TYPES.has(type)) {
    return false;
  }
  return isStreamObject(parsed.data) && widgetHasItems(parsed.data);
}

function hasEffectiveShopperContent(message: string): boolean {
  if (message.trim() === '') {
    return false;
  }
  try {
    const parsed = JSON.parse(message) as unknown;
    if (!isStreamObject(parsed)) {
      return true;
    }
    const caption = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    if (caption !== '') {
      return true;
    }
    return envelopeHasMeaningfulWidget(parsed);
  } catch {
    return true;
  }
}

function withSanitizedCompletion(response: EmporixAIChatResponse): EmporixAIChatResponse {
  const sanitized = sanitizeCompletedMessage(response.message);

  if (sanitized === response.message) {
    if (!hasEffectiveShopperContent(sanitized)) {
      return { ...response, message: '' };
    }
    return response;
  }

  if (sanitized === '') {
    // Plain planning text → fail closed. Incomplete JSON envelopes (e.g. streaming html)
    // can be wiped by the caption leak heuristic; keep the original buffer instead.
    if (!response.message.trimStart().startsWith('{')) {
      return { ...response, message: '' };
    }
    return response;
  }

  if (!hasEffectiveShopperContent(sanitized)) {
    return { ...response, message: '' };
  }
  return { ...response, message: sanitized };
}

function isToolOnlyStreamContent(textBuffer: string): boolean {
  const objects = collectCandidateStreamObjects(textBuffer);
  if (objects.length === 0) {
    return false;
  }
  return !objects.some((objectPayload) => hasFrontendAgentShape(objectPayload));
}

function responseFromTextBuffer(textBuffer: string, overlay: StreamIdentity): EmporixAIChatResponse {
  const assembled = pickAssembledResponse(collectCandidateStreamObjects(textBuffer), overlay);
  if (assembled) {
    return withSanitizedCompletion(assembled);
  }

  if (isToolOnlyStreamContent(textBuffer)) {
    return withSanitizedCompletion({
      agentId: overlay.agentId,
      agentType: overlay.agentType,
      sessionId: overlay.sessionId,
      message: '',
    });
  }

  return withSanitizedCompletion({
    agentId: overlay.agentId,
    agentType: overlay.agentType,
    sessionId: overlay.sessionId,
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
  widgetsByType: Map<string, WidgetState>;
  pendingWidget: string | null;
  thinking: boolean;
  cachedPreviewSource: string;
  cachedTokenPreview: StreamPreview | null;
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
    if (frame.eventName === 'error') {
      throwUpstreamStreamError(frame.payload);
    }
    if (frame.eventName === 'done') {
      consumeIdentityOnly(state, frame.payload);
    }
    return;
  }

  consumePayload(state, frame.payload);
}

function throwUpstreamStreamError(payload: string): never {
  let message = payload.trim() || 'AI stream reported an error';
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (isStreamObject(parsed)) {
      message = toStringValue(parsed.error) || toStringValue(parsed.message) || message;
    }
  } catch {
    // Use raw payload as error message.
  }
  throw new Error(message);
}

function consumeThinking(state: AssemblyState, payload: string): void {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (isStreamObject(parsed)) {
      state.thinking = true;
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
    state.widgetsByType.set(adapted.type, adapted);
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

const TOOL_WIDGET_FALLBACK: Record<string, string> = {
  product_selection: 'product_list',
  order_summary: 'order_list',
  return_details: 'return_list',
};

/**
 * When the agent's envelope names a widget type, that intent wins over the last tool that ran:
 * a turn that reads the customer (rules, owned products) and then lists products must not paint
 * the account card.
 */
function widgetForDeclaredType(state: AssemblyState, tokenPreview: StreamPreview): WidgetState | null | undefined {
  if (tokenPreview.kind !== 'widget' || !WIDGET_TYPES.has(tokenPreview.type)) {
    return undefined;
  }
  const declared = tokenPreview.type;
  if (!state.widget || state.widget.type === declared) {
    return undefined;
  }
  const tokenData = tokenWidgetData(tokenPreview, declared);
  if (tokenData && widgetHasItems(tokenData)) {
    return { type: declared, data: tokenData };
  }
  const toolWidget = state.widgetsByType.get(declared);
  if (toolWidget) {
    return toolWidget;
  }
  const fallbackType = TOOL_WIDGET_FALLBACK[declared];
  return (fallbackType && state.widgetsByType.get(fallbackType)) || derivedWidget(state, declared);
}

/** Checkout may read addresses from the customer profile instead of the company address tool. */
function derivedWidget(state: AssemblyState, declared: string): WidgetState | null {
  if (declared === 'checkout_confirm') {
    return { type: declared, data: { checkout: true } };
  }
  if (declared !== 'address_list') {
    return null;
  }
  const addresses = state.widgetsByType.get('account_details')?.data.addresses;
  return Array.isArray(addresses) && addresses.length > 0 ? { type: declared, data: { addresses } } : null;
}

function resolvedWidget(state: AssemblyState, tokenPreview = tokenPreviewFromState(state)): WidgetState | null {
  const declaredWidget = widgetForDeclaredType(state, tokenPreview);
  if (declaredWidget !== undefined) {
    return declaredWidget;
  }
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
  const envelope: Record<string, unknown> = {
    message: tokenIntroFromState(state),
    type: widget.type,
    data: widget.data,
  };
  if (widget.type === 'cart_summary') {
    envelope.cartRefresh = true;
  }
  return applyIdentityOverlay(
    {
      agentId: state.identityOverlay.agentId,
      agentType: state.identityOverlay.agentType,
      sessionId: state.identityOverlay.sessionId,
      message: JSON.stringify(envelope),
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
  if (declaresPlainAnswer(fromTokens)) {
    return fromTokens;
  }
  // Prefer tool-adapted widget over raw token envelopes that may carry unnormalized fields.
  return fromWidget;
}

/**
 * The agent reads tools such as `get-customer-info` to answer a question (a purchasing rule, a
 * device status); an envelope that explicitly answers with `text` / `html` must not be replaced by
 * that tool's card.
 */
function declaresPlainAnswer(response: EmporixAIChatResponse): boolean {
  try {
    const parsed = JSON.parse(response.message) as unknown;
    if (!isStreamObject(parsed) || (parsed.type !== 'text' && parsed.type !== 'html')) {
      return false;
    }
    const data = isStreamObject(parsed.data) ? parsed.data : {};
    return [parsed.message, data.message, data.html].some((value) => typeof value === 'string' && value.trim() !== '');
  } catch {
    return false;
  }
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

function finalizeAssemblyResponse(response: EmporixAIChatResponse, overlay: StreamIdentity): EmporixAIChatResponse {
  return assertNonEmptyMessage(withSanitizedCompletion(withFallbackIdentity(applyIdentityOverlay(response, overlay))));
}

function finishAssembly(state: AssemblyState): EmporixAIChatResponse {
  const overlay = state.identityOverlay;
  const chosen = pickRicherResponse(responseFromResolvedWidget(state), responseFromTokenEnvelope(state));
  if (chosen) {
    return finalizeAssemblyResponse(chosen, overlay);
  }

  if (state.capturedResponse) {
    return finalizeAssemblyResponse(state.capturedResponse, overlay);
  }

  if (state.textBuffer !== '') {
    return finalizeAssemblyResponse(responseFromTextBuffer(state.textBuffer, overlay), overlay);
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
