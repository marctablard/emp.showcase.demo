import { useCallback, useEffect, useState } from 'react';
import { QuoteHistory, UseQuoteHistoryResult } from '@/platform/services/model/quote';

export function useQuoteHistory(quoteId: string): UseQuoteHistoryResult {
  const [history, setHistory] = useState<QuoteHistory>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/quote/history?quoteId=${encodeURIComponent(quoteId)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch quote history');
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch quote history:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch quote history'));
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (quoteId) {
      fetchHistory();
    }
  }, [quoteId, fetchHistory]);

  return {
    history,
    loading,
    error,
    refetch: fetchHistory,
  };
}
