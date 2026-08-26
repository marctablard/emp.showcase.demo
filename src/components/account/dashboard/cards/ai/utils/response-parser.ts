/**
 * AI Response Parser Utility
 * Handles parsing and normalizing AI responses including markdown code blocks
 */
import { WIDGET_TYPES, sanitizeCompletedShopperText } from '@/lib/common/ai-stream-preview';
import { hasResolvedWidgetPayload } from '@/lib/common/ai-tool-widgets';
import { getLogger } from '@/lib/logger/use-logger-client';
import {
  UNRECOGNIZED_RESPONSE_TYPE,
  buildUnrecognizedResponseData,
  logUnrecognizedAiResponse,
  looksLikeStructuredCaption,
  resolveUnrecognizedLogSource,
  shopperCaptionFromRaw,
} from './unrecognized-response';

const JSON_CODE_BLOCK_PREFIX = '```json\n';
const CODE_BLOCK_PREFIX = '```\n';
const CODE_BLOCK_SUFFIX = '\n```';

export interface ParsedAIResponse {
  message: string;
  data: unknown | null;
  type: string;
  cartRefresh: boolean;
  /** Set when the assembled buffer looked like JSON but did not parse. */
  unparsedRaw?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const resolveParsedMessage = (parsed: Record<string, unknown>): string => {
  return typeof parsed.message === 'string' ? parsed.message : '';
};

const withCartRefresh = (nested: ParsedAIResponse, parsed: Record<string, unknown>): ParsedAIResponse => {
  return {
    ...nested,
    cartRefresh: nested.cartRefresh || Boolean(parsed.cartRefresh),
  };
};

const unwrapNestedAgentPayload = (parsed: Record<string, unknown>, depth: number): ParsedAIResponse | null => {
  if (depth >= 2) {
    return null;
  }

  const isComplete = parsed.type === 'complete';
  const isAgentEnvelope = typeof parsed.agentId === 'string' || typeof parsed.sessionId === 'string';

  if (typeof parsed.message === 'string') {
    if (!looksLikeStructuredCaption(parsed.message)) {
      return null;
    }
    if (!isComplete && !isAgentEnvelope) {
      return null;
    }
    return withCartRefresh(parseAIResponse(parsed.message, depth + 1), parsed);
  }

  if (isRecord(parsed.message) && (isComplete || isAgentEnvelope)) {
    return withCartRefresh(parseAIResponse(JSON.stringify(parsed.message), depth + 1), parsed);
  }

  return null;
};

/**
 * Parse AI response message, handling JSON and markdown code blocks
 * @param rawMessage - The raw message from the AI response
 * @returns Parsed AI response with message, data, type, and cartRefresh flag
 */
export const parseAIResponse = (rawMessage: string, depth = 0): ParsedAIResponse => {
  let messageToParse = rawMessage;

  // Remove markdown code block wrappers if present
  if (messageToParse.startsWith(JSON_CODE_BLOCK_PREFIX) && messageToParse.endsWith(CODE_BLOCK_SUFFIX)) {
    messageToParse = messageToParse.slice(JSON_CODE_BLOCK_PREFIX.length, -CODE_BLOCK_SUFFIX.length);
  } else if (messageToParse.startsWith(CODE_BLOCK_PREFIX) && messageToParse.endsWith(CODE_BLOCK_SUFFIX)) {
    messageToParse = messageToParse.slice(CODE_BLOCK_PREFIX.length, -CODE_BLOCK_SUFFIX.length);
  }

  try {
    const parsed = JSON.parse(messageToParse) as Record<string, unknown>;
    const unwrapped = unwrapNestedAgentPayload(parsed, depth);
    if (unwrapped) {
      return unwrapped;
    }
    return {
      message: resolveParsedMessage(parsed),
      data: parsed.data ?? null,
      type: typeof parsed.type === 'string' ? parsed.type : 'text',
      cartRefresh: Boolean(parsed.cartRefresh),
    };
  } catch (_error) {
    getLogger().debug({ rawMessage: messageToParse.substring(0, 100) }, 'AI Response Parser: Raw message is not JSON');
    if (looksLikeStructuredCaption(rawMessage)) {
      return {
        message: shopperCaptionFromRaw(rawMessage),
        data: null,
        type: 'text',
        cartRefresh: false,
        unparsedRaw: rawMessage,
      };
    }
    return {
      message: rawMessage,
      data: null,
      type: 'text',
      cartRefresh: false,
    };
  }
};

export type StreamPreviewFallback =
  | { kind: 'widget'; type: string; message: string; data: unknown }
  | { kind: 'html'; html: string }
  | { kind: 'text'; content: string }
  | null
  | undefined;

const shopperCaption = (value: string | null | undefined): string => {
  if (!value || looksLikeStructuredCaption(value)) {
    return '';
  }
  return sanitizeCompletedShopperText(value);
};

const isKnownRenderableType = (type: string): boolean => {
  return WIDGET_TYPES.has(type) || type === 'html';
};

const toUnrecognizedPayload = (
  caption: string,
  rawMessage: string,
  data: unknown,
): Pick<ParsedAIResponse, 'message' | 'data' | 'type'> => {
  logUnrecognizedAiResponse(resolveUnrecognizedLogSource(rawMessage, data));
  return {
    message: caption,
    data: buildUnrecognizedResponseData(rawMessage, data),
    type: UNRECOGNIZED_RESPONSE_TYPE,
  };
};

export const resolveCommittedChatPayload = (
  parsed: ParsedAIResponse,
  preview?: StreamPreviewFallback,
  rawMessage = parsed.unparsedRaw ?? parsed.message,
): Pick<ParsedAIResponse, 'message' | 'data' | 'type'> => {
  const sourceRaw = parsed.unparsedRaw ?? rawMessage;
  const parsedCaption = shopperCaption(parsed.message) || shopperCaptionFromRaw(sourceRaw);
  const previewCaption =
    preview?.kind === 'widget'
      ? shopperCaption(preview.message)
      : preview?.kind === 'text'
        ? shopperCaption(preview.content)
        : '';
  const caption = parsedCaption || previewCaption;

  const parsedHasResolvedWidget =
    isKnownRenderableType(parsed.type) && parsed.type !== 'html' && hasResolvedWidgetPayload(parsed.type, parsed.data);

  if (parsedHasResolvedWidget) {
    return { message: caption, data: parsed.data, type: parsed.type };
  }

  if (preview?.kind === 'widget' && hasResolvedWidgetPayload(preview.type, preview.data)) {
    return { message: caption || shopperCaption(preview.message), data: preview.data, type: preview.type };
  }

  if (preview?.kind === 'html') {
    return { message: caption, data: { html: preview.html }, type: 'html' };
  }

  if (parsed.type === 'html' && parsed.data != null) {
    return { message: caption, data: parsed.data, type: 'html' };
  }

  const looksUnrecognized =
    Boolean(parsed.unparsedRaw) ||
    looksLikeStructuredCaption(parsed.message) ||
    looksLikeStructuredCaption(sourceRaw) ||
    (parsed.type !== 'text' && parsed.type !== 'complete' && !parsedHasResolvedWidget);

  if (looksUnrecognized) {
    return toUnrecognizedPayload(caption, sourceRaw, parsed.data ?? (preview?.kind === 'widget' ? preview.data : null));
  }

  return {
    message: caption || parsedCaption,
    data: parsed.data,
    type: parsed.type === 'complete' ? 'text' : parsed.type,
  };
};
