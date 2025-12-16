'use client';

import { useCallback, useState } from 'react';
import type { Paginated } from '@/platform/services/model/common';
import type { Subscription } from '@/platform/services/subscription/SubscriptionService';

interface UseSubscriptionsOptions {
  initialPageSize?: number;
}

export function useSubscriptions(options: UseSubscriptionsOptions = {}) {
  const { initialPageSize = 10 } = options;

  const [data, setData] = useState<Paginated<Subscription> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const fetchSubscriptions = useCallback(
    async (pageNumber?: number, size?: number) => {
      const currentPage = pageNumber ?? page;
      const currentSize = size ?? pageSize;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/subscriptions?page=${currentPage}&size=${currentSize}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
        }
        const json = await response.json();
        setData(json);
        if (pageNumber !== undefined) setPage(pageNumber);
        if (size !== undefined) setPageSize(size);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Unknown error');
        setError(e);
        console.error('Error fetching subscriptions', e);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  );

  return {
    data,
    loading,
    error,
    page,
    pageSize,
    fetchSubscriptions,
    hasNextPage: data ? page < Math.ceil(data.total / pageSize) - 1 : false,
    hasPreviousPage: page > 0,
  };
}
