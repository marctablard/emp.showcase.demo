import { z } from 'zod';

/**
 * Validation schema for AI chat context
 */
export const AIChatContextSchema = z.object({
  siteId: z.string().optional(),
  currency: z.string().optional(),
  language: z.string().optional(),
  sessionId: z.string().optional(),
  cartId: z.string().optional(),
});

/**
 * Validation schema for AI chat request
 */
export const AIChatRequestSchema = z.object({
  userMessage: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
  context: AIChatContextSchema,
});

export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;
export type AIChatContext = z.infer<typeof AIChatContextSchema>;
