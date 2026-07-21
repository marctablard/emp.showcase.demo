'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { SearchFilterLeafValue, SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Quote } from '@/platform/services/model/quote';

function appendQuoteFilterParam(queryParams: URLSearchParams, key: string, value: SearchFilterLeafValue): void {
  if (Array.isArray(value)) {
    queryParams.append(key, value.join(','));
    return;
  }

  queryParams.append(key, value);
}

interface UseQuotesOptions extends SearchParams<Quote> {
  /** Total item count seeded from SSR, used to compute pagination before the first client fetch. */
  initialTotalCount?: number;
  /** The exact params SSR used to fetch `initialQuotes`, used to decide if the initial client fetch can be skipped. */
  initialRequest?: {
    page?: number;
    size?: number;
    sort?: string;
    query?: string;
  };
}

/**
 * Hook for fetching quotes
 * @param initialQuotes Optional initial quotes data (from SSR)
 * @param params Optional search params for client-side filtering
 */
export function useQuotes(initialQuotes?: Quote[], params?: UseQuotesOptions) {
  const page = params?.page;
  const size = params?.size;
  const sort = params?.sort;
  const searchQuery = params?.query;
  const filters = params?.filters;
  const initialTotalCount = params?.initialTotalCount;
  const initialRequest = params?.initialRequest;

  const canReuseInitialData =
    !!initialQuotes &&
    (page ?? 0) === (initialRequest?.page ?? 0) &&
    size === initialRequest?.size &&
    sort === initialRequest?.sort &&
    searchQuery === initialRequest?.query;

  const [loading, setLoading] = useState<boolean>(!canReuseInitialData);
  const [error, setError] = useState<Error | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes || []);
  const [pagination, setPagination] = useState<
    | {
        pageNumber: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
      }
    | undefined
  >(() => {
    if (initialTotalCount === undefined) {
      return undefined;
    }
    const pageSize = size || 10;
    return {
      pageNumber: page ?? 0,
      pageSize,
      totalPages: Math.max(1, Math.ceil(initialTotalCount / pageSize)),
      totalItems: initialTotalCount,
    };
  });
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

      const queryParams = new URLSearchParams();
      if (page !== undefined) {
        queryParams.append('page', page.toString());
      }
      if (size !== undefined) {
        queryParams.append('size', size.toString());
      }
      if (sort !== undefined) {
        queryParams.append('sort', sort);
      }
      if (searchQuery !== undefined) {
        queryParams.append('q', searchQuery);
      }
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            appendQuoteFilterParam(queryParams, key, value);
          } else if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([nestedKey, nestedValue]) => {
              appendQuoteFilterParam(queryParams, `${key}[${nestedKey}]`, nestedValue);
            });
          } else {
            appendQuoteFilterParam(queryParams, key, value);
          }
        });
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await fetch(`/api/quotes${queryString}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch quotes: ${res.statusText}`);
      }

      const response: SearchResult<Quote> = await res.json();

      setQuotes(response.items || []);
      const totalItems = response.total >= 0 ? response.total : (response.items?.length ?? 0);
      const pageSize = response.pageSize || size || 10;
      setPagination({
        pageNumber: response.page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
        totalItems,
      });
      setAvailableFilters(response.availableFilters || []);
    } catch (err) {
      getLogger().error({ err }, 'Error fetching quotes');
      setError(err instanceof Error ? err : new Error('Failed to fetch quotes'));
    } finally {
      setLoading(false);
    }
  }, [page, size, sort, searchQuery, filters]);

  const refetchQuotes = useCallback(async () => {
    await fetchQuotes();
  }, [fetchQuotes]);

  // Skip only the initial fetch when SSR data matches the exact params it was fetched with.
  useEffect(() => {
    if (!canReuseInitialData) {
      fetchQuotes();
    }
  }, [canReuseInitialData, fetchQuotes]);

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
