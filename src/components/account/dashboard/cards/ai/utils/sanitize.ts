/**
 * Input Sanitization Utility
 * Provides functions to sanitize user input before sending to the AI service
 */

const MAX_MESSAGE_LENGTH = 2000;
const FORBIDDEN_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/gi, /on\w+=/gi];

export interface SanitizeResult {
  sanitized: string;
  wasModified: boolean;
  error?: string;
}

/**
 * Sanitize user input by trimming, checking length, and removing forbidden patterns
 * @param input - Raw user input
 * @returns Sanitization result with sanitized string and metadata
 */
export function sanitizeUserInput(input: string): SanitizeResult {
  if (!input || typeof input !== 'string') {
    return { sanitized: '', wasModified: true, error: 'Invalid input' };
  }

  let sanitized = input.trim();
  let wasModified = sanitized !== input;

  // Check length
  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
    wasModified = true;
  }

  // Remove forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    const newValue = sanitized.replace(pattern, '');
    if (newValue !== sanitized) {
      sanitized = newValue;
      wasModified = true;
    }
  }

  return { sanitized, wasModified };
}

/**
 * Check if input contains any potentially dangerous patterns
 * @param input - String to check
 * @returns true if dangerous patterns are found
 */
export function containsDangerousPatterns(input: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(input));
}
