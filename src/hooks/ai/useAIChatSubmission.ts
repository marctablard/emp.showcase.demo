'use client';

import { useCallback, useRef } from 'react';
import type { AiHelperFormData, ChatMessage } from '@/components/account/dashboard/cards/ai/types';
import { parseAIResponse } from '@/components/account/dashboard/cards/ai/utils/response-parser';
import { sanitizeUserInput } from '@/components/account/dashboard/cards/ai/utils/sanitize';
import { prepareAIContext } from '@/lib/client/ai';
import type { Session } from '@/platform/services/model/session/session';
import type { CartStore } from '@/stores/cart-store';
import { useAI } from './useAI';

interface UseAIChatSubmissionOptions {
  session: Session | null;
  cartStore: CartStore;
  onMessageSent: (userMessage: ChatMessage) => void;
  onResponseReceived: (aiMessage: ChatMessage) => void;
  onError: (errorMessage: ChatMessage) => void;
  onCartRefresh: () => Promise<void>;
  errorMessageText: string;
}

interface UseAIChatSubmissionReturn {
  submit: (data: AiHelperFormData) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for handling AI chat submission logic
 */
export function useAIChatSubmission({
  session,
  cartStore,
  onMessageSent,
  onResponseReceived,
  onError,
  onCartRefresh,
  errorMessageText,
}: UseAIChatSubmissionOptions): UseAIChatSubmissionReturn {
  const { sendMessageWithContext, loading, error } = useAI();
  const messageIdCounter = useRef(0);

  const generateId = useCallback(() => {
    return `${Date.now()}-${++messageIdCounter.current}`;
  }, []);

  const submit = useCallback(
    async (data: AiHelperFormData): Promise<boolean> => {
      const { sanitized, error: sanitizeError } = sanitizeUserInput(data.question);
      if (sanitizeError || !sanitized || !session) {
        return false;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        content: sanitized,
        isUser: true,
        timestamp: new Date(),
      };
      onMessageSent(userMessage);

      try {
        const context = await prepareAIContext(session, cartStore);
        const aiResponse = await sendMessageWithContext(sanitized, context);
        const parsed = parseAIResponse(aiResponse.message);

        const aiMessage: ChatMessage = {
          id: generateId(),
          content: parsed.message,
          isUser: false,
          timestamp: new Date(),
          data: parsed.data,
          type: parsed.type,
        };
        onResponseReceived(aiMessage);

        if (parsed.cartRefresh || aiResponse.cartRefresh) {
          await onCartRefresh();
        }

        return true;
      } catch (_err) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          content: errorMessageText,
          isUser: false,
          timestamp: new Date(),
        };
        onError(errorMessage);
        return false;
      }
    },
    [
      session,
      cartStore,
      sendMessageWithContext,
      generateId,
      onMessageSent,
      onResponseReceived,
      onError,
      onCartRefresh,
      errorMessageText,
    ],
  );

  return { submit, loading, error };
}
