'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchOrderById as apiFetchOrderById,
  fetchOrderStatusTransitions as apiFetchOrderStatusTransitions,
} from '@/lib/client/orders';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Order } from '@/platform/services/model/order/order';

interface UseOrderOptions {
  orderId?: string;
  initialOrder?: Order | null;
}

interface UseOrderResult {
  // Order data
  order: Order | null | undefined;
  statusTransitions: string[];

  // Status
  loading: boolean;
  error: Error | null;

  // Order operations
  cancelOrder?: () => Promise<void>;
  returnOrder?: () => Promise<void>;

  // Utility
  refetchOrder: () => Promise<void>;
  refetchStatusTransitions: () => Promise<void>;
}

/**
 * Hook for interacting with a single order
 *
 * @param options Configuration options for the hook
 * @returns Order data and operations
 */
export const useOrder = (options: UseOrderOptions = {}): UseOrderResult => {
  const { orderId, initialOrder } = options;
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [order, setOrder] = useState<Order | null | undefined>(initialOrder);
  const [statusTransitions, setStatusTransitions] = useState<string[]>([]);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const orderData = await apiFetchOrderById(orderId);
      setOrder(orderData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch order'));
      getLogger().error({ err, orderId }, 'Error fetching order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchStatusTransitions = useCallback(async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const transitions = await apiFetchOrderStatusTransitions(orderId);
      setStatusTransitions(transitions);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch status transitions'));
      getLogger().error({ err, orderId }, 'Error fetching status transitions');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Cancel order function - implementation would depend on your API
  const cancelOrder = useCallback(async () => {
    if (!orderId || !order) return;

    // Check if cancellation is allowed based on status transitions
    if (!statusTransitions.includes('CANCELLED')) {
      throw new Error('Order cannot be cancelled in its current state');
    }

    try {
      setLoading(true);
      setError(null);

      // This would be replaced with an actual API call
      // await apiCancelOrder(orderId);

      // After cancellation, refetch the order to get updated status
      await fetchOrder();
      await fetchStatusTransitions();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to cancel order'));
      getLogger().error({ err, orderId }, 'Error cancelling order');
    } finally {
      setLoading(false);
    }
  }, [orderId, order, statusTransitions, fetchOrder, fetchStatusTransitions]);

  // Return order function - implementation would depend on your API
  const returnOrder = useCallback(async () => {
    if (!orderId || !order) return;

    // Check if return is allowed based on status or business rules
    // This is a placeholder - actual implementation would depend on your requirements
    if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
      throw new Error('Order cannot be returned in its current state');
    }

    try {
      setLoading(true);
      setError(null);

      // This would be replaced with an actual API call
      // await apiReturnOrder(orderId);

      // After return request, refetch the order to get updated status
      await fetchOrder();
      await fetchStatusTransitions();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to return order'));
      getLogger().error({ err, orderId }, 'Error returning order');
    } finally {
      setLoading(false);
    }
  }, [orderId, order, fetchOrder, fetchStatusTransitions]);

  // Initialize on first render
  useEffect(() => {
    if (orderId && order === undefined) {
      fetchOrder();
      fetchStatusTransitions();
    }
  }, [orderId, order, fetchOrder, fetchStatusTransitions]);

  return {
    order,
    statusTransitions,
    loading,
    error,
    cancelOrder: order ? cancelOrder : undefined,
    returnOrder: order ? returnOrder : undefined,
    refetchOrder: fetchOrder,
    refetchStatusTransitions: fetchStatusTransitions,
  };
};
