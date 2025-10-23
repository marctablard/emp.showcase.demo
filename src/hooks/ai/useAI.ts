import { useCallback, useState } from 'react';
import { getAICartSummary, sendAIChatMessage, sendAIChatMessageWithContext } from '@/lib/client/ai';
import { AIChatContext, AIChatRequest, AIChatResponse } from '@/platform/integrations/ai/model';

export interface UseAIResult {
  sendMessage: (request: AIChatRequest) => Promise<AIChatResponse>;
  sendMessageWithContext: (userMessage: string, context: AIChatContext) => Promise<AIChatResponse>;
  getCartSummary: (cartId: string, siteId: string, currency: string, language: string) => Promise<AIChatResponse>;
  loading: boolean;
  error: Error | null;
}

export function useAI(): UseAIResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(async (request: AIChatRequest): Promise<AIChatResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await sendAIChatMessage(request);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send AI message');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessageWithContext = useCallback(
    async (userMessage: string, context: AIChatContext): Promise<AIChatResponse> => {
      setLoading(true);
      setError(null);

      try {
        const response = await sendAIChatMessageWithContext(userMessage, context);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to send AI message with context');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getCartSummary = useCallback(
    async (cartId: string, siteId: string, currency: string, language: string): Promise<AIChatResponse> => {
      setLoading(true);
      setError(null);

      try {
        const response = await getAICartSummary(cartId, siteId, currency, language);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to get AI cart summary');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    sendMessage,
    sendMessageWithContext,
    getCartSummary,
    loading,
    error,
  };
}
