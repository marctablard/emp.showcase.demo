'use client';

import { useContext } from 'react';
import { useStore } from 'zustand/react';
import { CartStoreContext } from '@/providers/StoreProvider';

/**
 * `true` while a cart write is queued or running. Promo apply/remove do not flip
 * `useCart().loading`, so checkout submit must read this instead.
 */
export function useIsCartMutating(): boolean {
  const storeContext = useContext(CartStoreContext);
  if (!storeContext) {
    throw new Error('useIsCartMutating must be used within StoreProvider');
  }
  return useStore(storeContext, (state) => state.mutating);
}
