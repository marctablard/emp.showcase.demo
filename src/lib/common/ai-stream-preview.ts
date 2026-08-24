import { findMatchingBrace } from './json-brace-scan';

const JSON_CODE_BLOCK_PREFIX = '```json\n';
const CODE_BLOCK_PREFIX = '```\n';
const CODE_BLOCK_SUFFIX = '\n```';

export const WIDGET_TYPES = new Set([
  'cart_summary',
  'account_details',
  'order_list',
  'order_summary',
  'product_list',
  'product_selection',
  'address_list',
  'quote_list',
  'quote_details',
  'return_list',
  'return_details',
  'table',
  'error',
]);

export { widgetTypeFromToolName } from './ai-tool-widgets';

export type StreamPreview =
  | { kind: 'pending' }
  | { kind: 'text'; content: string }
  | { kind: 'html'; html: string }
  | { kind: 'widget'; type: string; message: string; data: unknown };

export type AIChatStreamProgressUpdate = {
  chunks: number;
  preview?: Exclude<StreamPreview, { kind: 'pending' }>;
  thinking?: string;
};

function stripMarkdownCodeBlock(rawMessage: string): string {
  if (rawMessage.startsWith(JSON_CODE_BLOCK_PREFIX) && rawMessage.endsWith(CODE_BLOCK_SUFFIX)) {
    return rawMessage.slice(JSON_CODE_BLOCK_PREFIX.length, -CODE_BLOCK_SUFFIX.length);
  }
  if (rawMessage.startsWith(CODE_BLOCK_PREFIX) && rawMessage.endsWith(CODE_BLOCK_SUFFIX)) {
    return rawMessage.slice(CODE_BLOCK_PREFIX.length, -CODE_BLOCK_SUFFIX.length);
  }
  return rawMessage;
}

const COMPLETE_MARKDOWN_FENCE_PATTERN = /^```(?:json)?\r?\n([\s\S]*?)```\r?\n?/i;

function stripLeadingCompleteMarkdownFences(text: string): { text: string; blocked: boolean } {
  let remainder = text;

  while (true) {
    const trimmed = remainder.trimStart();
    const match = COMPLETE_MARKDOWN_FENCE_PATTERN.exec(trimmed);
    if (!match) {
      break;
    }
    remainder = trimmed.slice(match[0].length);
  }

  if (remainder.trimStart().startsWith('```')) {
    return { text: '', blocked: true };
  }

  return { text: remainder.trimStart(), blocked: false };
}

function unescapePartialJsonString(value: string): string {
  return value
    .replaceAll(String.raw`\n`, '\n')
    .replaceAll(String.raw`\"`, '"')
    .replaceAll(String.raw`\\`, '\\');
}

const MAX_SHOPPER_CAPTION_CHARS = 512;
const MARKDOWN_HEADING_PATTERN = /(?:^|\n)#{1,6}\s+\S/m;
const ENVELOPE_LEAK_PATTERN = /"(?:type|data|agentId|sessionId|tool_call)"\s*:/;

function looksLikeNonShopperCaption(value: string, options: { enforceMaxLength: boolean }): boolean {
  if (options.enforceMaxLength && value.length > MAX_SHOPPER_CAPTION_CHARS) {
    return true;
  }

  // Any ATX heading is CoT / planning (e.g. ## SESSION INTENT), not shopper copy.
  if (MARKDOWN_HEADING_PATTERN.test(value)) {
    return true;
  }

  if (value.includes('{') && ENVELOPE_LEAK_PATTERN.test(value)) {
    return true;
  }

  return false;
}

/** Live caption filter — length-capped and planning-aware. */
export const sanitizeShopperCaption = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  if (looksLikeNonShopperCaption(value, { enforceMaxLength: true })) {
    return '';
  }
  return value;
};

/** Completed shopper text — planning/CoT filtered, no 512-char rejection. */
export const sanitizeCompletedShopperText = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  if (looksLikeNonShopperCaption(value, { enforceMaxLength: false })) {
    return '';
  }
  return value;
};

function extractPartialJsonStringField(
  text: string,
  fieldName: string,
  useLastMatch = false,
  allowPartialUnclosed = false,
): string | null {
  const fieldPattern = new RegExp(String.raw`"` + fieldName + String.raw`"\s*:\s*"`, 'g');
  let selectedMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null = fieldPattern.exec(text);

  while (match) {
    selectedMatch = match;
    if (!useLastMatch) {
      break;
    }
    match = fieldPattern.exec(text);
  }

  if (!selectedMatch) {
    return null;
  }

  let index = selectedMatch.index + selectedMatch[0].length;
  let result = '';
  let escaped = false;

  while (index < text.length) {
    const character = text[index];
    if (escaped) {
      result += character;
      escaped = false;
      index += 1;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      index += 1;
      continue;
    }
    if (character === '"') {
      return unescapePartialJsonString(result);
    }
    result += character;
    index += 1;
  }

  if (result === '') {
    return null;
  }

  if (!allowPartialUnclosed) {
    return null;
  }

  return unescapePartialJsonString(result);
}

const PARTIAL_JSON_TYPE_PATTERN = /"type"\s*:\s*"([^"]*)"/;

function extractPartialJsonType(text: string): string | null {
  const typeMatch = PARTIAL_JSON_TYPE_PATTERN.exec(text);
  return typeMatch?.[1] ?? null;
}

function extractPartialJsonObjectField(text: string, fieldName: string): Record<string, unknown> | null {
  const fieldPattern = new RegExp(String.raw`"` + fieldName + String.raw`"\s*:\s*\{`);
  const match = fieldPattern.exec(text);
  if (!match) {
    return null;
  }
  const start = match.index + match[0].length - 1;
  const end = findMatchingBrace(text, start);
  if (end === -1) {
    return null;
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function widgetPreview(type: string, message: string, data: unknown): StreamPreview {
  return { kind: 'widget', type, message: sanitizeShopperCaption(message), data: data ?? {} };
}

function looksLikeStructuredPayload(value: string): boolean {
  const trimmed = value.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```');
}

function previewFromShopperMessage(value: string): StreamPreview {
  if (value === '') {
    return { kind: 'pending' };
  }
  if (looksLikeStructuredPayload(value)) {
    return previewStreamingAIMessageFromSource(value);
  }
  const content = sanitizeShopperCaption(value);
  if (!content) {
    return { kind: 'pending' };
  }
  return { kind: 'text', content };
}

function htmlFromEnvelopeData(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('html' in data)) {
    return null;
  }
  const html = (data as { html?: unknown }).html;
  return typeof html === 'string' ? html : null;
}

function nestedMessageFromEnvelopeData(data: unknown): string {
  if (!data || typeof data !== 'object' || !('message' in data)) {
    return '';
  }
  const nested = (data as { message?: unknown }).message;
  return typeof nested === 'string' ? nested : '';
}

function textContentFromEnvelope(intro: string, nestedMessage: string): string {
  if (nestedMessage && nestedMessage !== intro) {
    if (intro) {
      return `${intro}\n${nestedMessage}`;
    }
    return nestedMessage;
  }
  return intro || nestedMessage;
}

function previewFromParsedEnvelope(parsed: Record<string, unknown>): StreamPreview {
  const type = typeof parsed.type === 'string' ? parsed.type : 'text';

  if (type === 'html') {
    const html = htmlFromEnvelopeData(parsed.data);
    if (html) {
      return { kind: 'html', html };
    }
    return { kind: 'pending' };
  }

  const intro = sanitizeShopperCaption(typeof parsed.message === 'string' ? parsed.message : '');
  if (WIDGET_TYPES.has(type)) {
    return widgetPreview(type, intro, parsed.data);
  }

  const content = textContentFromEnvelope(intro, nestedMessageFromEnvelopeData(parsed.data));
  if (content) {
    const sanitized = sanitizeShopperCaption(content);
    if (!sanitized) {
      return { kind: 'pending' };
    }
    return { kind: 'text', content: sanitized };
  }

  return { kind: 'pending' };
}

function previewFromIncompleteJson(text: string): StreamPreview {
  const partialType = extractPartialJsonType(text);
  const trimmed = text.trimStart();

  // Only treat root `type: "html"` as an HTML bubble — nested product/order
  // description fields named `html` must not hijack the preview.
  if (partialType === 'html') {
    const html = extractPartialJsonStringField(text, 'html', true, true);
    if (html) {
      return { kind: 'html', html };
    }
    return { kind: 'pending' };
  }

  const message = extractPartialJsonStringField(text, 'message') ?? '';
  if (partialType && WIDGET_TYPES.has(partialType)) {
    return widgetPreview(partialType, message, extractPartialJsonObjectField(text, 'data') ?? {});
  }

  if (message) {
    const preview = previewFromShopperMessage(message);
    if (preview.kind !== 'pending') {
      return preview;
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('```')) {
    return { kind: 'pending' };
  }

  if (text !== '') {
    const content = sanitizeShopperCaption(text);
    if (!content) {
      return { kind: 'pending' };
    }
    return { kind: 'text', content };
  }

  return { kind: 'pending' };
}

function previewStreamingAIMessageFromSource(rawMessage: string): StreamPreview {
  const messageToParse = stripMarkdownCodeBlock(rawMessage);

  try {
    const parsed = JSON.parse(messageToParse) as unknown;
    if (parsed && typeof parsed === 'object') {
      return previewFromParsedEnvelope(parsed as Record<string, unknown>);
    }
  } catch {
    return previewFromIncompleteJson(messageToParse);
  }

  return { kind: 'pending' };
}

export const previewStreamingAIMessage = (rawMessage: string): StreamPreview => {
  const { text: previewSource, blocked } = stripLeadingCompleteMarkdownFences(rawMessage);
  if (blocked || previewSource === '') {
    return { kind: 'pending' };
  }

  return previewStreamingAIMessageFromSource(previewSource);
};

export const toStreamProgressUpdate = (
  chunks: number,
  preview: StreamPreview,
  thinking?: string,
): AIChatStreamProgressUpdate => {
  const update: AIChatStreamProgressUpdate = { chunks };
  if (preview.kind === 'text' && preview.content === '') {
    // Empty text after caption sanitization — keep spinner, do not paint a blank bubble.
  } else if (preview.kind !== 'pending') {
    update.preview = preview;
  }
  if (thinking) {
    update.thinking = thinking;
  }
  return update;
};
