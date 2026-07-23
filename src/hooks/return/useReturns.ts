'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchReturnsPage } from '@/lib/client/returns';
import type { Return } from '@/platform/services/model/return';

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
  forceRefreshOnMount?: boolean;
  initialTotalCount?: number;
  initialRequest?: {
    pageSize?: number;
    pageNumber?: number;
    sort?: string;
    query?: string;
  };
}

/**
 * Hook for fetching and managing returns list
 * @param initialReturns Optional initial returns data (from SSR)
 * @param pageSize Optional page size (default: 60)
 * @param pageNumber Optional page number (default: 1)
 */
export function useReturns(initialReturns?: Return[], options: UseReturnsOptions = {}): UseReturnsReturn {
  const { pageSize, pageNumber, sort, query, forceRefreshOnMount = false, initialTotalCount, initialRequest } = options;
  const [returns, setReturns] = useState<Return[]>(initialReturns || []);
  const [totalCount, setTotalCount] = useState<number | undefined>(initialTotalCount);

  const canReuseInitialData =
    !!initialReturns &&
    pageNumber === (initialRequest?.pageNumber ?? 1) &&
    pageSize === initialRequest?.pageSize &&
    query === initialRequest?.query &&
    sort === initialRequest?.sort;

  const [loading, setLoading] = useState<boolean>(!canReuseInitialData);
  const [error, setError] = useState<Error | null>(null);

  const fetchReturnsData = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchReturnsPage(pageSize, pageNumber, query, sort, forceRefresh);
        setReturns(data.items);
        setTotalCount(data.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [pageSize, pageNumber, query, sort],
  );

  const refreshReturns = useCallback(async () => {
    await fetchReturnsData(true);
  }, [fetchReturnsData]);

  useEffect(() => {
    if (!canReuseInitialData || forceRefreshOnMount) {
      fetchReturnsData(forceRefreshOnMount);
    }
  }, [canReuseInitialData, forceRefreshOnMount, fetchReturnsData]);

  return {
    returns,
    totalCount,
    loading,
    error,
    refreshReturns,
  };
}
