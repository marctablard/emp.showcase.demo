'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchReturnsPage } from '@/lib/client/returns';
import { Return } from '@/platform/services/model/return';

interface UseReturnsReturn {
  returns: Return[];
  totalCount?: number;
  loading: boolean;
  error: Error | null;
  refreshReturns: () => Promise<void>;
}

interface UseReturnsOptions {
  pageSize?: number;
  pageNumber?: number;
  sort?: string;
  query?: string;
}

/**
 * Hook for fetching and managing returns list
 * @param initialReturns Optional initial returns data (from SSR)
 * @param pageSize Optional page size (default: 60)
 * @param pageNumber Optional page number (default: 1)
 */
export function useReturns(initialReturns?: Return[], options: UseReturnsOptions = {}): UseReturnsReturn {
  const { pageSize, pageNumber, sort, query } = options;
  const [returns, setReturns] = useState<Return[]>(initialReturns || []);
  const [totalCount, setTotalCount] = useState<number | undefined>(initialReturns?.length);
  const [loading, setLoading] = useState<boolean>(!initialReturns || pageNumber !== 1 || !!query || !!sort);
  const [error, setError] = useState<Error | null>(null);

  const fetchReturnsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReturnsPage(pageSize, pageNumber, query, sort);
      setReturns(data.items);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [pageSize, pageNumber, query, sort]);

  const refreshReturns = useCallback(async () => {
    await fetchReturnsData();
  }, [fetchReturnsData]);

  useEffect(() => {
    // Use SSR-provided returns only for the default first-page, no-query/no-sort-load.
    const canReuseInitialData = !!initialReturns && pageNumber === 1 && !query && !sort;
    if (!canReuseInitialData) {
      fetchReturnsData();
    }
  }, [initialReturns, pageNumber, query, sort, fetchReturnsData]);

  return {
    returns,
    totalCount,
    loading,
    error,
    refreshReturns,
  };
}
