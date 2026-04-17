'use client';

import { useCallback, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Paginated } from '@/platform/services/model/common';

interface UseSavedCartsOptions {
  initialPageSize?: number;
}

export function useSavedCarts(options: UseSavedCartsOptions = {}) {
  const { initialPageSize = 10 } = options;

  const [savedCarts, setSavedCarts] = useState<Paginated<Cart> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const fetchSavedCarts = useCallback(
    async (pageNumber?: number, size?: number) => {
      const currentPage = pageNumber !== undefined ? pageNumber : page;
      const currentSize = size !== undefined ? size : pageSize;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/carts/saved?page=${currentPage}&pageSize=${currentSize}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch saved carts: ${response.statusText}`);
        }

        const data = await response.json();
        setSavedCarts(data);

        // Update pagination state if it was changed in the function call
        if (pageNumber !== undefined) setPage(pageNumber);
        if (size !== undefined) setPageSize(size);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        getLogger().error({ err }, 'Error fetching saved carts');
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  );

  const goToNextPage = useCallback(() => {
    if (savedCarts && page < Math.ceil(savedCarts.total / pageSize) - 1) {
      fetchSavedCarts(page + 1);
    }
  }, [fetchSavedCarts, page, pageSize, savedCarts]);

  const goToPreviousPage = useCallback(() => {
    if (page > 0) {
      fetchSavedCarts(page - 1);
    }
  }, [fetchSavedCarts, page]);

  const changePageSize = useCallback(
    (newSize: number) => {
      fetchSavedCarts(0, newSize);
    },
    [fetchSavedCarts],
  );

  return {
    savedCarts,
    loading,
    error,
    page,
    pageSize,
    fetchSavedCarts,
    goToNextPage,
    goToPreviousPage,
    changePageSize,
    hasNextPage: savedCarts ? page < Math.ceil(savedCarts.total / pageSize) - 1 : false,
    hasPreviousPage: page > 0,
  };
}
