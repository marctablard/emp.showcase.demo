'use client';

import { useContext } from 'react';
import { useStore } from 'zustand/react';
import { CartStoreContext } from '@/providers/StoreProvider';

/**
 * `true` while the cart store is in a settling window (e.g. site switch). Unlike
 * `useCart().loading`, stays `true` across intermediate transitions so header surfaces can
 * render a single spinner. Cart page / checkout should keep using `useCart().loading`.
 */
export function useIsCartSettling(): boolean {
  const storeContext = useContext(CartStoreContext);
  if (!storeContext) {
    throw new Error('useIsCartSettling must be used within StoreProvider');
  }
  return useStore(storeContext, (state) => state.isSettling);
}
