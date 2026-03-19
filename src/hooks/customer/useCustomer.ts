'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchCurrentCustomer } from '@/lib/client/customer';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Customer } from '@/platform/services/model/customer/customer';
import { useCustomerStore } from '@/providers/StoreProvider';

interface CustomerHook {
  customer: Customer | null | undefined;
  loading: boolean;
  error: Error | null;
  fetchCustomer: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for customer data
 * @returns Customer data and state
 */
export const useCustomer = (initialCustomer?: Customer | null): CustomerHook => {
  const { customer, loading, getLoading, setLoading, setCustomer, reset } = useCustomerStore();
  const { status } = useSession();

  // only preload on initial load
  useEffect(() => {
    if (initialCustomer !== undefined) {
      setCustomer(initialCustomer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomer]);

  const [error, setError] = useState<Error | null>(null);

  const fetchCustomer = useCallback(async () => {
    try {
      // Only fetch when authenticated
      if (status !== 'authenticated') {
        if (getLoading()) {
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError(null);
      const data = await fetchCurrentCustomer();
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch customer'));
      getLogger().error({ err }, 'Error fetching customer');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setCustomer, status, getLoading]);

  // Initialize customer on first render if not already initialized
  useEffect(() => {
    // Do not fetch when unauthenticated or during session loading
    if (status !== 'authenticated') {
      setCustomer(null);
      if (getLoading()) {
        setLoading(false);
      }
      return;
    }

    if (!customer && !getLoading()) {
      setLoading(true);
      // check without state-effect
      fetchCustomer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return {
    customer,
    loading,
    error,
    fetchCustomer,
    reset,
  };
};

export default useCustomer;
