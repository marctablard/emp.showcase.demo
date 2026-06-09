'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import { buildSearchQuery } from '@/platform/integrations/emporix/common/util/common';
import type { Order } from '@/platform/services/model/order/order';
import { useOrderStore } from '@/providers/StoreProvider';

interface UseOrdersOptions {
  initialOrders?: Order[];
  pageSize?: number;
  pageNumber?: number;
  filters?: Record<string, any>;
  query?: string;
  forceRefresh?: boolean;
}

interface UseOrdersResult {
  // Orders data
  orders: Order[] | undefined;

  // Status
  loading: boolean;
  error: Error | null;

  // Pagination
  pageSize: number;
  pageNumber: number;
  setPageSize: (size: number) => void;
  setPageNumber: (page: number) => void;

  // Filtering
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;

  // Utility
  refetchOrders: () => Promise<void>;
}

function createOrderQueryKey(searchQuery: { query: string; body: unknown }, freeTextQuery?: string): string {
  return JSON.stringify({
    query: searchQuery.query,
    body: searchQuery.body,
    search: freeTextQuery ?? null,
  });
}

/**
 * Hook for managing collections of orders with pagination, filtering, and searching
 * This is now a simple pass-through to the order store
 *
 * @param options Configuration options for the hook
 * @returns Orders data and operations
 */
export const useOrders = (options: UseOrdersOptions = {}): UseOrdersResult => {
  const {
    initialOrders = undefined,
    pageSize: initialPageSize = 50,
    pageNumber: initialPageNumber = 1,
    filters: initialFilters = {},
    query: searchQuery,
    forceRefresh = false,
  } = options;

  const {
    getOrders: getStoreOrders,
    setOrders: setStoreOrders,
    getLoading: getStoreLoading,
    getError: getStoreError,
    fetchOrders: storeFetchOrders,
  } = useOrderStore();

  // Local state for pagination and filters
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [pageNumber, setPageNumber] = useState<number>(initialPageNumber);
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);

  // Generate query key for current parameters
  const query = buildSearchQuery({
    page: pageNumber,
    size: pageSize,
    criteria: filters,
  });
  const queryKey = createOrderQueryKey(query, searchQuery);

  useEffect(() => {
    // Initialize with initialOrders if provided and not already in store
    if (initialOrders && !getStoreOrders(queryKey) && !getStoreLoading(queryKey)) {
      setStoreOrders(queryKey, initialOrders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrders, queryKey]);

  // Get current state from store
  const orders = getStoreOrders(queryKey) || initialOrders;
  const loading = getStoreLoading(queryKey);
  const error = getStoreError(queryKey);

  // Re-fetch orders; honours the configurable `forceRefresh` flag (default: false)
  const refetchOrders = useCallback(async () => {
    try {
      await storeFetchOrders(pageSize, pageNumber, filters, forceRefresh, searchQuery);
    } catch (err) {
      // Error is already handled in the store
      getLogger().error({ err, pageSize, pageNumber }, 'Error in refetchOrders');
    }
  }, [pageSize, pageNumber, filters, forceRefresh, searchQuery, storeFetchOrders]);

  // Auto-fetch when parameters change and we don't have data
  useEffect(() => {
    if (!orders && !loading) {
      refetchOrders();
    }
  }, [pageSize, pageNumber, filters, searchQuery, orders, loading, refetchOrders]);

  return {
    orders,
    loading,
    error,
    pageSize,
    pageNumber,
    setPageSize,
    setPageNumber,
    filters,
    setFilters,
    refetchOrders,
  };
};
