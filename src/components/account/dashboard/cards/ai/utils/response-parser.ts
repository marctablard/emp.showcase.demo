/**
 * AI Response Parser Utility
 * Handles parsing and normalizing AI responses including markdown code blocks
 */
import { getLogger } from '@/lib/logger/use-logger-client';

const JSON_CODE_BLOCK_PREFIX = '```json\n';
const CODE_BLOCK_PREFIX = '```\n';
const CODE_BLOCK_SUFFIX = '\n```';

export interface ParsedAIResponse {
  message: string;
  data: unknown | null;
  type: string;
  cartRefresh: boolean;
}

const resolveParsedMessage = (parsed: Record<string, unknown>, rawMessage: string, messageToParse: string): string => {
  if (typeof parsed.message === 'string') {
    return parsed.message;
  }
  const type = typeof parsed.type === 'string' ? parsed.type : 'text';
  if (type !== 'text' || parsed.data != null) {
    return '';
  }
  return rawMessage === messageToParse ? rawMessage : messageToParse;
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
    if (depth < 2 && parsed.type === 'complete' && typeof parsed.message === 'string') {
      const nested = parseAIResponse(parsed.message, depth + 1);
      return {
        ...nested,
        cartRefresh: nested.cartRefresh || Boolean(parsed.cartRefresh),
      };
    }
    return {
      message: resolveParsedMessage(parsed, rawMessage, messageToParse),
      data: parsed.data ?? null,
      type: typeof parsed.type === 'string' ? parsed.type : 'text',
      cartRefresh: Boolean(parsed.cartRefresh),
    };
  } catch (_error) {
    getLogger().debug({ rawMessage: messageToParse.substring(0, 100) }, 'AI Response Parser: Raw message is not JSON');
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

export const resolveCommittedChatPayload = (
  parsed: ParsedAIResponse,
  preview?: StreamPreviewFallback,
): Pick<ParsedAIResponse, 'message' | 'data' | 'type'> => {
  const parsedHasWidget = parsed.type !== 'text' && parsed.type !== 'complete' && parsed.data != null;
  if (parsedHasWidget) {
    return { message: parsed.message, data: parsed.data, type: parsed.type };
  }
  if (preview?.kind === 'widget') {
    return {
      message: parsed.message || preview.message,
      data: preview.data,
      type: preview.type,
    };
  }
  if (preview?.kind === 'html') {
    return { message: parsed.message, data: { html: preview.html }, type: 'html' };
  }
  return {
    message: parsed.message,
    data: parsed.data,
    type: parsed.type === 'complete' ? 'text' : parsed.type,
  };
};
