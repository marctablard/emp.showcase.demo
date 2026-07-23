'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import { createOrderRequestKey } from '@/lib/order/create-order-request-key';
import type { Order } from '@/platform/services/model/order/order';
import { useOrderStore } from '@/providers/StoreProvider';

interface UseOrdersOptions {
  initialOrders?: Order[];
  initialTotalCount?: number;
  pageSize?: number;
  pageNumber?: number;
  query?: string;
  sort?: string;
  forceRefresh?: boolean;
  initialRequest?: {
    pageSize?: number;
    pageNumber?: number;
    sort?: string;
    query?: string;
  };
}

interface UseOrdersResult {
  // Orders data
  orders: Order[] | undefined;

  // Status
  loading: boolean;
  error: Error | null;
  totalCount?: number;

  // Pagination
  pageSize: number;
  pageNumber: number;
  setPageSize: (size: number) => void;
  setPageNumber: (page: number) => void;

  // Utility
  refetchOrders: () => Promise<void>;
}

/**
 * Hook for managing collections of orders with pagination and searching
 * This is now a simple pass-through to the order store
 *
 * @param options Configuration options for the hook
 * @returns Orders data and operations
 */
export const useOrders = (options: UseOrdersOptions = {}): UseOrdersResult => {
  const {
    initialOrders = undefined,
    initialTotalCount,
    pageSize: initialPageSize = 50,
    pageNumber: initialPageNumber = 1,
    query: searchQuery,
    sort,
    forceRefresh = false,
    initialRequest,
  } = options;

  const {
    getOrders: getStoreOrders,
    getTotalCount: getStoreTotalCount,
    setOrders: setStoreOrders,
    getLoading: getStoreLoading,
    getError: getStoreError,
    fetchOrders: storeFetchOrders,
  } = useOrderStore();

  // Local state for pagination
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [pageNumber, setPageNumber] = useState<number>(initialPageNumber);

  // Generate query key for current request parameters.
  const queryKey = createOrderRequestKey(pageSize, pageNumber, searchQuery, sort);
  const shouldHydrateFromInitialOrders =
    Boolean(initialOrders) &&
    pageNumber === (initialRequest?.pageNumber ?? initialPageNumber) &&
    pageSize === (initialRequest?.pageSize ?? initialPageSize) &&
    searchQuery === initialRequest?.query &&
    sort === initialRequest?.sort;

  useEffect(() => {
    // Keep the initial request cache in sync with SSR data on mount.
    if (shouldHydrateFromInitialOrders && initialOrders && !getStoreLoading(queryKey)) {
      setStoreOrders(queryKey, initialOrders, initialTotalCount ?? initialOrders.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrders, initialTotalCount, queryKey, shouldHydrateFromInitialOrders]);

  // Get current state from store
  const orders = getStoreOrders(queryKey) || (shouldHydrateFromInitialOrders ? initialOrders : undefined);
  const totalCount =
    getStoreTotalCount(queryKey) ??
    (shouldHydrateFromInitialOrders ? (initialTotalCount ?? initialOrders?.length) : undefined);
  const loading = getStoreLoading(queryKey);
  const error = getStoreError(queryKey);

  // Re-fetch orders; honours the configurable `forceRefresh` flag (default: false)
  const refetchOrders = useCallback(async () => {
    try {
      await storeFetchOrders(pageSize, pageNumber, forceRefresh, searchQuery, sort);
    } catch (err) {
      // Error is already handled in the store
      getLogger().error({ err, pageSize, pageNumber }, 'Error in refetchOrders');
    }
  }, [pageSize, pageNumber, forceRefresh, searchQuery, sort, storeFetchOrders]);

  // Auto-fetch when parameters change and we don't have data
  useEffect(() => {
    if (!orders && !loading) {
      refetchOrders();
    }
  }, [pageSize, pageNumber, searchQuery, orders, loading, refetchOrders]);

  return {
    orders,
    loading,
    error,
    totalCount,
    pageSize,
    pageNumber,
    setPageSize,
    setPageNumber,
    refetchOrders,
  };
};
