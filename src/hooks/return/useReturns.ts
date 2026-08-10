'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { useSession } from '@/hooks/session/useSession';
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
  const { session } = useSession();
  // Refetch (bypassing the client returns cache) when the header company switch
  // updates the session's legalEntityId, since the response is LE-scoped.
  const legalEntityId = typeof session?.legalEntityId === 'string' ? session.legalEntityId.trim() : '';
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

  // Skip only the initial fetch when SSR data matches the exact params it was fetched with.
  // Seeded during render but only ever read/written inside the effect: once the first effect run
  // has consumed it, every later param change refetches.
  const skipInitialFetchRef = useRef(canReuseInitialData && !forceRefreshOnMount);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    return startEffectTask(() => fetchReturnsData(forceRefreshOnMount));
  }, [forceRefreshOnMount, fetchReturnsData]);

  // Dedicated LE watcher: separate from the main effect so that when the legal
  // entity changes we always bypass the client cache (`forceRefresh: true`) —
  // baking `legalEntityId` into `fetchReturnsData`'s deps would instead call it
  // with `forceRefreshOnMount` and let the LE-stale cache win.
  const previousLegalEntityIdRef = useRef(legalEntityId);
  useEffect(() => {
    if (previousLegalEntityIdRef.current === legalEntityId) {
      return;
    }
    previousLegalEntityIdRef.current = legalEntityId;
    return startEffectTask(() => fetchReturnsData(true));
  }, [legalEntityId, fetchReturnsData]);

  return {
    returns,
    totalCount,
    loading,
    error,
    refreshReturns,
  };
}
