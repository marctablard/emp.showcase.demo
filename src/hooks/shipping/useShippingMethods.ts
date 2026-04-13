'use client';

import { useCallback, useState } from 'react';
import { getShippingMethods, invalidateShippingMethodsResponseCache } from '@/lib/client/shipping';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { ShippingMethod } from '@/platform/services/model/shipping';
import { useSessionStore, useShippingMethodsStore } from '@/providers/StoreProvider';

interface UseShippingMethods {
  shippingMethods: ShippingMethod[];
  loading: boolean;
  error: Error | null;
  fetchShippingMethods: (
    countryCode: string,
    postalCode: string,
    orderValue?: { amount: number; currency: string },
  ) => Promise<void>;
  clearShippingMethods: () => void;
}

/**
 * Hook for managing shipping methods
 * @returns Shipping methods data and operations
 */
export const useShippingMethods = (): UseShippingMethods => {
  const { shippingMethods, loading, setLoading, setShippingMethods } = useShippingMethodsStore();
  const { session } = useSessionStore();
  const [error, setError] = useState<Error | null>(null);
  const fetchShippingMethods = useCallback(
    async (
      countryCode: string,
      postalCode: string,
      orderValue?: { amount: number; currency: string },
    ): Promise<void> => {
      if (!countryCode || !postalCode) {
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const sessionContext =
          session != null
            ? {
                siteCode: session.siteCode,
                currency: session.currency,
                legalEntityId: session.legalEntityId,
              }
            : undefined;
        const methods = await getShippingMethods(countryCode, postalCode, orderValue, sessionContext);
        setShippingMethods(methods);
      } catch (err) {
        getLogger().error({ err }, 'Error fetching shipping methods');
        setError(err instanceof Error ? err : new Error('Failed to fetch shipping methods'));
      } finally {
        setLoading(false);
      }
    },
    [session, setShippingMethods, setLoading],
  );

  const clearShippingMethods = useCallback(() => {
    invalidateShippingMethodsResponseCache();
    setShippingMethods([]);
  }, [setShippingMethods]);

  return {
    shippingMethods,
    loading,
    error,
    fetchShippingMethods,
    clearShippingMethods,
  };
};
