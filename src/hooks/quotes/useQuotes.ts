'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import { SearchParams, SearchResult } from '@/platform/services/model/common';
import { Quote } from '@/platform/services/model/quote';

/**
 * Hook for fetching quotes
 * @param initialQuotes Optional initial quotes data (from SSR)
 * @param params Optional search params for client-side filtering
 */
export function useQuotes(initialQuotes?: Quote[], params?: SearchParams<Quote>) {
  const [loading, setLoading] = useState<boolean>(!initialQuotes);
  const [error, setError] = useState<Error | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes || []);
  const [pagination, setPagination] = useState<{
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  }>();
  const [availableFilters, setAvailableFilters] = useState<
    Array<{
      id: string;
      name?: string;
      values: Array<{
        id: string;
        name?: string;
        count?: number;
        active: boolean;
      }>;
    }>
  >([]);

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string from params
      const queryParams = new URLSearchParams();
      if (params) {
        if (params.page !== undefined) {
          queryParams.append('page', params.page.toString());
        }
        if (params.size !== undefined) {
          queryParams.append('size', params.size.toString());
        }
        if (params.sort !== undefined) {
          queryParams.append('sort', params.sort);
        }
        if (params.query !== undefined) {
          queryParams.append('q', params.query);
        }
        // Add criteria filters if present
        if (params.filters) {
          Object.entries(params.filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              queryParams.append(key, value.join(','));
            } else {
              queryParams.append(key, value);
            }
          });
        }
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await fetch(`/api/quotes${queryString}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch quotes: ${res.statusText}`);
      }

      const response: SearchResult<Quote> = await res.json();

      setQuotes(response.items || []);
      setPagination({
        pageNumber: response.page,
        pageSize: response.pageSize,
        totalPages: Math.ceil(response.total / response.pageSize),
        totalItems: response.total,
      });
      setAvailableFilters(response.availableFilters || []);
    } catch (err) {
      getLogger().error({ err }, 'Error fetching quotes');
      setError(err instanceof Error ? err : new Error('Failed to fetch quotes'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  const refetchQuotes = useCallback(async () => {
    await fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    if (!initialQuotes) {
      fetchQuotes();
    }
  }, [initialQuotes, fetchQuotes]);

  return {
    loading,
    error,
    quotes,
    pagination,
    availableFilters,
    refetchQuotes,
  };
}

/**
 * Hook for fetching a single quote by ID
 */
export function useQuote(quoteId: string | undefined) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchQuote = async () => {
      if (!quoteId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch quote from API
        const res = await fetch(`/api/quotes/${quoteId}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch quote ${quoteId}: ${res.statusText}`);
        }

        const response: Quote = await res.json();

        if (isMounted) {
          setQuote(response);
        }
      } catch (err) {
        if (isMounted) {
          getLogger().error({ err, quoteId }, 'Error fetching quote');
          setError(err instanceof Error ? err : new Error(`Failed to fetch quote ${quoteId}`));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchQuote();

    return () => {
      isMounted = false;
    };
  }, [quoteId]);

  return {
    loading,
    error,
    quote,
  };
}
