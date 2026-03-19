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

/**
 * Parse AI response message, handling JSON and markdown code blocks
 * @param rawMessage - The raw message from the AI response
 * @returns Parsed AI response with message, data, type, and cartRefresh flag
 */
export function parseAIResponse(rawMessage: string): ParsedAIResponse {
  let messageToParse = rawMessage;

  // Remove markdown code block wrappers if present
  if (messageToParse.startsWith(JSON_CODE_BLOCK_PREFIX) && messageToParse.endsWith(CODE_BLOCK_SUFFIX)) {
    messageToParse = messageToParse.slice(JSON_CODE_BLOCK_PREFIX.length, -CODE_BLOCK_SUFFIX.length);
  } else if (messageToParse.startsWith(CODE_BLOCK_PREFIX) && messageToParse.endsWith(CODE_BLOCK_SUFFIX)) {
    messageToParse = messageToParse.slice(CODE_BLOCK_PREFIX.length, -CODE_BLOCK_SUFFIX.length);
  }

  try {
    const parsed = JSON.parse(messageToParse);
    return {
      message: parsed.message || rawMessage,
      data: parsed.data || null,
      type: parsed.type || 'text',
      cartRefresh: parsed.cartRefresh || false,
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
}
