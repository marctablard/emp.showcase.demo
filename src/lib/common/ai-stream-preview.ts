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

function stripLeadingCompleteMarkdownFences(text: string): { text: string; blocked: boolean } {
  let remainder = text;

  while (true) {
    const trimmed = remainder.trimStart();
    const match = trimmed.match(/^```(?:json)?\r?\n([\s\S]*?)```\r?\n?/i);
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
  return value.replaceAll('\\n', '\n').replaceAll('\\"', '"').replaceAll('\\\\', '\\');
}

const MAX_SHOPPER_CAPTION_CHARS = 512;
const MARKDOWN_HEADING_PATTERN = /(?:^|\n)#{1,6}\s+\S/gm;
const ENVELOPE_LEAK_PATTERN = /"(?:type|data|agentId|sessionId|tool_call)"\s*:/;
const BLANK_LINE_BLOCK_PATTERN = /\n\s*\n/g;

function countMarkdownHeadings(value: string): number {
  return value.match(MARKDOWN_HEADING_PATTERN)?.length ?? 0;
}

function countBlankLineBlocks(value: string): number {
  return value.match(BLANK_LINE_BLOCK_PATTERN)?.length ?? 0;
}

function looksLikeNonShopperCaption(value: string): boolean {
  if (value.length > MAX_SHOPPER_CAPTION_CHARS) {
    return true;
  }

  const headingCount = countMarkdownHeadings(value);
  if (headingCount >= 2) {
    return true;
  }

  if (headingCount >= 1 && (value.length > 280 || countBlankLineBlocks(value) >= 2)) {
    return true;
  }

  if (value.includes('{') && ENVELOPE_LEAK_PATTERN.test(value)) {
    return true;
  }

  return false;
}

export const sanitizeShopperCaption = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  if (looksLikeNonShopperCaption(value)) {
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
  const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`, 'g');
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

function extractPartialJsonType(text: string): string | null {
  const typeMatch = text.match(/"type"\s*:\s*"([^"]*)"/);
  return typeMatch?.[1] ?? null;
}

function extractPartialJsonObjectField(text: string, fieldName: string): Record<string, unknown> | null {
  const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*\\{`);
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
  return { kind: 'text', content: sanitizeShopperCaption(value) };
}

function previewFromParsedEnvelope(parsed: Record<string, unknown>): StreamPreview {
  const type = typeof parsed.type === 'string' ? parsed.type : 'text';

  if (type === 'html') {
    const data = parsed.data;
    const html =
      data && typeof data === 'object' && 'html' in data && typeof (data as { html?: unknown }).html === 'string'
        ? (data as { html: string }).html
        : null;
    if (html) {
      return { kind: 'html', html };
    }
    return { kind: 'pending' };
  }

  const intro = sanitizeShopperCaption(typeof parsed.message === 'string' ? parsed.message : '');
  if (WIDGET_TYPES.has(type)) {
    return widgetPreview(type, intro, parsed.data);
  }

  const nested =
    parsed.data && typeof parsed.data === 'object' && 'message' in parsed.data
      ? (parsed.data as { message?: unknown }).message
      : undefined;
  const body = typeof nested === 'string' ? nested : '';
  const content = body && body !== intro ? `${intro}${intro ? '\n' : ''}${body}` : intro || body;

  if (content) {
    return { kind: 'text', content: sanitizeShopperCaption(content) };
  }

  return { kind: 'pending' };
}

function previewFromIncompleteJson(text: string): StreamPreview {
  const partialType = extractPartialJsonType(text);
  const trimmed = text.trimStart();

  if (partialType === 'html' || /"html"\s*:\s*"/.test(text)) {
    const html = extractPartialJsonStringField(text, 'html', true, true);
    if (html) {
      return { kind: 'html', html };
    }
    if (partialType === 'html') {
      return { kind: 'pending' };
    }
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
    return { kind: 'text', content: sanitizeShopperCaption(text) };
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
  if (preview.kind !== 'pending') {
    update.preview = preview;
  }
  if (thinking) {
    update.thinking = thinking;
  }
  return update;
};
