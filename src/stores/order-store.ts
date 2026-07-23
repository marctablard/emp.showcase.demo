'use client';

import { create } from 'zustand';
import { fetchOrdersPage as apiFetchOrdersPage } from '@/lib/client/orders';
import type { OrdersPageResult } from '@/lib/client/orders';
import { getLogger } from '@/lib/logger/use-logger-client';
import { createOrderRequestKey } from '@/lib/order/create-order-request-key';
import type { Order } from '@/platform/services/model/order/order';

export interface OrderState {
  // Order data
  orderQueries: Record<string, string[]>;
  orders: Record<string, Order>;
  totals: Record<string, number | undefined>;
  loading: Record<string, boolean>;
  error: Record<string, Error | null>;
  updated: number;
  // Track ongoing fetches to prevent duplicates
  ongoingFetches: Record<string, Promise<OrdersPageResult>>;
}
interface OrderActions {
  setOrders: (query: string, orders: Order[], totalCount?: number) => void;
  getOrders: (query: string) => Order[] | undefined;
  getTotalCount: (query: string) => number | undefined;

  setLoading: (query: string, loading: boolean) => void;
  getLoading: (query: string) => boolean;

  setError: (query: string, error: Error | null) => void;
  getError: (query: string) => Error | null;

  // Fetch operations
  fetchOrders: (
    pageSize: number,
    pageNumber: number,
    forceRefresh?: boolean,
    query?: string,
    sort?: string,
  ) => Promise<Order[]>;

  reset: () => void;
}
export type OrderStore = OrderState & OrderActions;

const defaultState: OrderState = {
  orderQueries: {},
  orders: {},
  totals: {},
  loading: {},
  error: {},
  updated: 0,
  ongoingFetches: {},
};

export const createOrderStore = () =>
  create<OrderStore>()((set, get) => ({
    ...defaultState,
    setOrders: (query: string, orders: Order[], totalCount?: number) => {
      // Store order IDs in the query mapping
      const orderIds = orders.map((order) => order.id);
      const orderQueries = {
        ...get().orderQueries,
        [query]: orderIds,
      };

      const totals = {
        ...get().totals,
        ...(totalCount !== undefined ? { [query]: totalCount } : {}),
      };

      // Add each order to the orders record with its ID as the key
      const orderRecords = get().orders;
      orders.forEach((order: Order) => {
        orderRecords[order.id] = order;
      });

      // Update the store with the new orders
      set((state) => ({
        ...state,
        orders: orderRecords,
        orderQueries: orderQueries,
        totals,
        updated: state.updated + 1,
      }));
    },
    getOrders: (query: string) => {
      const ids: string[] = get().orderQueries[query];
      return ids ? ids.map((id) => get().orders[id]) : undefined;
    },
    getTotalCount: (query: string) => get().totals[query],
    setLoading: (query: string, loading: boolean) => set({ loading: { ...get().loading, [query]: loading } }),
    getLoading: (query: string) => get().loading[query] || false,

    setError: (query: string, error: Error | null) => set({ error: { ...get().error, [query]: error } }),
    getError: (query: string) => get().error[query] || null,

    fetchOrders: async (
      pageSize: number,
      pageNumber: number,
      forceRefresh: boolean = false,
      query?: string,
      sort?: string,
    ) => {
      const queryKey = createOrderRequestKey(pageSize, pageNumber, query, sort);

      // Reuse cached data unless a caller explicitly requests a forced refresh.
      if (!forceRefresh) {
        const existingOrders = get().getOrders(queryKey);
        if (existingOrders && !get().getLoading(queryKey)) {
          return existingOrders;
        }
      }

      // Check if there's already an ongoing fetch for this query
      const ongoingFetch = get().ongoingFetches[queryKey];
      if (ongoingFetch !== undefined) {
        const result = await ongoingFetch;
        return result.items;
      }

      // Start new fetch
      const fetchPromise = (async () => {
        try {
          set({
            loading: { ...get().loading, [queryKey]: true },
            error: { ...get().error, [queryKey]: null },
          });

          const ordersData = await apiFetchOrdersPage(pageSize, pageNumber, query, sort);

          // Store the fetched orders
          get().setOrders(queryKey, ordersData.items, ordersData.totalCount);

          return ordersData;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to fetch orders');
          set({
            error: { ...get().error, [queryKey]: error },
            loading: { ...get().loading, [queryKey]: false },
          });
          getLogger().error({ err }, 'Error fetching orders');
          throw error;
        } finally {
          // Remove from ongoing fetches and set loading to false
          const { ongoingFetches, loading } = get();
          const newOngoingFetches = { ...ongoingFetches };
          delete newOngoingFetches[queryKey];

          set({
            ongoingFetches: newOngoingFetches,
            loading: { ...loading, [queryKey]: false },
          });
        }
      })();

      // Store the ongoing fetch promise
      set({
        ongoingFetches: { ...get().ongoingFetches, [queryKey]: fetchPromise },
      });

      const result = await fetchPromise;
      return result.items;
    },

    reset: () => set(defaultState),
  }));
