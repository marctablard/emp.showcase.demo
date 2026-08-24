import { useCallback, useState } from 'react';
import { sendAIChatMessageWithContext } from '@/lib/client/ai';
import type { AIChatStreamProgressUpdate, StreamPreview } from '@/lib/common/ai-stream-preview';
import type { AIChatContext, AIChatResponse } from '@/platform/integrations/ai/model';

export type StreamingPreview = Exclude<StreamPreview, { kind: 'pending' }>;

export interface UseAIResult {
  sendMessageWithContext: (
    userMessage: string,
    context: AIChatContext,
    onSuccess?: (response: AIChatResponse) => void,
  ) => Promise<AIChatResponse>;
  loading: boolean;
  chunkCount: number | null;
  streamingPreview: StreamingPreview | null;
  streamingThinking: string | null;
  error: Error | null;
}

export const useAI = (): UseAIResult => {
  const [loading, setLoading] = useState(false);
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [streamingPreview, setStreamingPreview] = useState<StreamingPreview | null>(null);
  const [streamingThinking, setStreamingThinking] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const handleProgress = useCallback((progress: AIChatStreamProgressUpdate) => {
    setChunkCount(progress.chunks);
    setStreamingPreview((current) => progress.preview ?? current);
    setStreamingThinking((current) => progress.thinking ?? current);
  }, []);

  const sendMessageWithContext = useCallback(
    async (
      userMessage: string,
      context: AIChatContext,
      onSuccess?: (response: AIChatResponse) => void,
    ): Promise<AIChatResponse> => {
      setLoading(true);
      setChunkCount(null);
      setStreamingPreview(null);
      setStreamingThinking(null);
      setError(null);

      try {
        const response = await sendAIChatMessageWithContext(userMessage, context, handleProgress);
        onSuccess?.(response);
        return response;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
        setChunkCount(null);
        setStreamingPreview(null);
        setStreamingThinking(null);
      }
    },
    [handleProgress],
  );

  return {
    sendMessageWithContext,
    loading,
    chunkCount,
    streamingPreview,
    streamingThinking,
    error,
  };
};
