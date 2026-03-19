'use client';

import { create } from 'zustand';
import { fetchOrders as apiFetchOrders } from '@/lib/client/orders';
import { getLogger } from '@/lib/logger/use-logger-client';
import { buildSearchQuery } from '@/platform/integrations/emporix/common/util/common';
import { Order } from '@/platform/services/model/order/order';

export interface OrderState {
  // Order data
  orderQueries: Record<string, string[]>;
  orders: Record<string, Order>;
  loading: Record<string, boolean>;
  error: Record<string, Error | null>;
  updated: number;
  // Track ongoing fetches to prevent duplicates
  ongoingFetches: Record<string, Promise<Order[]>>;
}
interface OrderActions {
  setOrders: (query: string, orders: Order[]) => void;
  getOrders: (query: string) => Order[] | undefined;

  setLoading: (query: string, loading: boolean) => void;
  getLoading: (query: string) => boolean;

  setError: (query: string, error: Error | null) => void;
  getError: (query: string) => Error | null;

  // Fetch operations
  fetchOrders: (
    pageSize: number,
    pageNumber: number,
    filters?: Record<string, any>,
    forceRefresh?: boolean,
  ) => Promise<Order[]>;

  reset: () => void;
}
export type OrderStore = OrderState & OrderActions;

const defaultState: OrderState = {
  orderQueries: {},
  orders: {},
  loading: {},
  error: {},
  updated: 0,
  ongoingFetches: {},
};

export const createOrderStore = () =>
  create<OrderStore>()((set, get) => ({
    ...defaultState,
    setOrders: (query: string, orders: Order[]) => {
      // Store order IDs in the query mapping
      const orderIds = orders.map((order) => order.id);
      const orderQueries = {
        ...get().orderQueries,
        [query]: orderIds,
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
        updated: state.updated + 1,
      }));
    },
    getOrders: (query: string) => {
      const ids: string[] = get().orderQueries[query];
      return ids ? ids.map((id) => get().orders[id]) : undefined;
    },
    setLoading: (query: string, loading: boolean) => set({ loading: { ...get().loading, [query]: loading } }),
    getLoading: (query: string) => get().loading[query] || false,

    setError: (query: string, error: Error | null) => set({ error: { ...get().error, [query]: error } }),
    getError: (query: string) => get().error[query] || null,

    fetchOrders: async (
      pageSize: number,
      pageNumber: number,
      filters: Record<string, any> = {},
      forceRefresh: boolean = false,
    ) => {
      const query = buildSearchQuery({
        page: pageNumber,
        size: pageSize,
        criteria: filters,
      });
      const queryKey = query.query + query.body;

      // Check if we already have this data and it's not stale (skip when forceRefresh is true)
      if (!forceRefresh) {
        const existingOrders = get().getOrders(queryKey);
        if (existingOrders && !get().getLoading(queryKey)) {
          return existingOrders;
        }
      }

      // Check if there's already an ongoing fetch for this query
      const ongoingFetch = get().ongoingFetches[queryKey];
      if (ongoingFetch) {
        return ongoingFetch;
      }

      // Start new fetch
      const fetchPromise = (async () => {
        try {
          set({
            loading: { ...get().loading, [queryKey]: true },
            error: { ...get().error, [queryKey]: null },
          });

          const ordersData = await apiFetchOrders(pageSize, pageNumber);

          // Store the fetched orders
          get().setOrders(queryKey, ordersData);

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

      return fetchPromise;
    },

    reset: () => set(defaultState),
  }));
