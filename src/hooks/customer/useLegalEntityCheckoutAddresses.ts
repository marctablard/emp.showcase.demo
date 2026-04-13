'use client';

import { useContext, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from 'zustand/react';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import { CustomerStoreContext, SessionStoreContext } from '@/providers/StoreProvider';
import type { CustomerStore } from '@/stores/customer-store';
import type { SessionStore } from '@/stores/session-store-context';
import { useSite } from '../site/useSite';
import useCustomer from './useCustomer';

function useCustomerStoreSlice<T>(selector: (s: CustomerStore) => T): T {
  const api = useContext(CustomerStoreContext);
  if (!api) {
    throw new Error('useLegalEntityCheckoutAddresses must be used within StoreProvider');
  }
  return useStore(api, selector);
}

function useShopSessionSlice<T>(selector: (s: SessionStore) => T): T {
  const api = useContext(SessionStoreContext);
  if (!api) {
    throw new Error('useLegalEntityCheckoutAddresses must be used within StoreProvider');
  }
  return useStore(api, selector);
}

/**
 * Legal entity location addresses for B2B checkout — backed by customer store so
 * all consumers share one fetch per (siteCode, legalEntityId, customerId).
 * @param skip When true, does not trigger fetch (e.g. B2C).
 */
export function useLegalEntityCheckoutAddresses(skip = false) {
  const { status } = useSession();
  const { customer } = useCustomer();
  const { site } = useSite();
  const shopSession = useShopSessionSlice((s) => s.session);

  const addresses = useCustomerStoreSlice((s) => s.legalEntityCheckoutAddresses);
  const addressLoading = useCustomerStoreSlice((s) => s.legalEntityCheckoutAddressLoading);
  const ensureLegalEntityCheckoutAddresses = useCustomerStoreSlice((s) => s.ensureLegalEntityCheckoutAddresses);
  const invalidateLegalEntityCheckoutAddresses = useCustomerStoreSlice((s) => s.invalidateLegalEntityCheckoutAddresses);

  const resolvedLegalEntityId = resolveLegalEntityIdFromSessionAndCustomer(shopSession, customer);
  const cacheKey =
    status === 'authenticated' && customer?.id && resolvedLegalEntityId && site?.code
      ? `${site.code}|${resolvedLegalEntityId}|${customer.id}`
      : '';

  useEffect(() => {
    if (status === 'unauthenticated') {
      invalidateLegalEntityCheckoutAddresses();
    }
  }, [status, invalidateLegalEntityCheckoutAddresses]);

  useEffect(() => {
    if (skip || !cacheKey) {
      return;
    }
    void ensureLegalEntityCheckoutAddresses(cacheKey);
  }, [skip, cacheKey, ensureLegalEntityCheckoutAddresses]);

  if (skip || status !== 'authenticated' || !cacheKey) {
    return { addresses: undefined, loading: false };
  }

  const loading = addressLoading || addresses === undefined;

  return {
    addresses: addresses ?? [],
    loading,
  };
}
