import { useCallback, useState } from 'react';
import { sendAIChatMessageWithContext } from '@/lib/client/ai';
import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';

export interface UseAIResult {
  sendMessageWithContext: (userMessage: string, context: AIChatContext) => Promise<AIChatResponse>;
  loading: boolean;
  chunkCount: number | null;
  error: Error | null;
}

export function useAI(): UseAIResult {
  const [loading, setLoading] = useState(false);
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const sendMessageWithContext = useCallback(
    async (userMessage: string, context: AIChatContext): Promise<AIChatResponse> => {
      setLoading(true);
      setChunkCount(null);
      setError(null);

      try {
        return await sendAIChatMessageWithContext(userMessage, context, setChunkCount);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
        setChunkCount(null);
      }
    },
    [],
  );

  return {
    sendMessageWithContext,
    loading,
    chunkCount,
    error,
  };
}
