'use client';

import { create } from 'zustand';
import type { ShippingMethod } from '@/platform/services/model/shipping';

export interface ShippingMethodsState {
  // Site data
  shippingMethods: ShippingMethod[];
  loading: boolean;
}

interface ShippingMethodsActions {
  setShippingMethods: (shippingMethods: ShippingMethod[]) => void;
  getShippingMethods: () => ShippingMethod[];

  setLoading: (loading: boolean) => void;
  getLoading: () => boolean;
  reset: () => void;
}
export type ShippingMethodsStore = ShippingMethodsState & ShippingMethodsActions;

const defaultState: ShippingMethodsState = {
  shippingMethods: [],
  loading: false,
};

export const createShippingMethodsStore = (initState: ShippingMethodsState = defaultState) => {
  return create<ShippingMethodsStore>()((set, get) => ({
    ...initState,
    setShippingMethods: (shippingMethods: ShippingMethod[]) => set({ shippingMethods }),
    getShippingMethods: () => get().shippingMethods,
    setLoading: (loading: boolean) => set({ loading }),
    getLoading: () => get().loading,
    reset: () => set(defaultState),
  }));
};
