'use client';

import { create } from 'zustand';
import { fetchLegalEntityCheckoutAddresses } from '@/lib/client/customer';
import { Customer } from '@/platform/services/model/customer/customer';
import { CustomerAddress } from '@/platform/services/model/customer/customer';

const leAddressInFlight = new Map<string, Promise<void>>();

export interface CustomerState {
  customer: Customer | null | undefined;
  addresses: CustomerAddress[] | undefined;
  loading: boolean;
  addressLoading: boolean;
  /** Cached legal-entity checkout addresses; key = site|legalEntity|customer */
  legalEntityCheckoutAddresses: CustomerAddress[] | undefined;
  legalEntityCheckoutAddressesLoadedForKey: string | null;
  legalEntityCheckoutAddressLoading: boolean;
  /** Monotonic counter so stale in-flight LE address fetches do not overwrite state */
  leAddressFetchSeq: number;
}

interface CustomerActions {
  setCustomer: (customer: Customer | null | undefined) => void;
  getCustomer: () => Customer | null | undefined;

  setAddresses: (addresses: CustomerAddress[] | undefined) => void;
  getAddresses: () => CustomerAddress[] | undefined;

  setLoading: (loading: boolean) => void;
  getLoading: () => boolean;

  setAddressLoading: (addressLoading: boolean) => void;
  getAddressLoading: () => boolean;

  ensureLegalEntityCheckoutAddresses: (cacheKey: string) => Promise<void>;
  invalidateLegalEntityCheckoutAddresses: () => void;

  reset: () => void;
}
export type CustomerStore = CustomerState & CustomerActions;

const defaultState: CustomerState = {
  customer: undefined,
  addresses: undefined,
  loading: false,
  addressLoading: false,
  legalEntityCheckoutAddresses: undefined,
  legalEntityCheckoutAddressesLoadedForKey: null,
  legalEntityCheckoutAddressLoading: false,
  leAddressFetchSeq: 0,
};

export const createCustomerStore = (initState: CustomerState = defaultState) => {
  return create<CustomerStore>()((set, get) => ({
    ...initState,
    setCustomer: (customer: Customer | null | undefined) => set({ customer }),
    getCustomer: () => get().customer,
    setAddresses: (addresses: CustomerAddress[] | undefined) => set({ addresses }),
    getAddresses: () => get().addresses,
    setLoading: (loading: boolean) => set({ loading }),
    getLoading: () => get().loading,
    setAddressLoading: (addressLoading: boolean) => set({ addressLoading }),
    getAddressLoading: () => get().addressLoading,

    ensureLegalEntityCheckoutAddresses: async (cacheKey: string) => {
      if (!cacheKey) {
        return;
      }
      const s = get();
      if (s.legalEntityCheckoutAddressesLoadedForKey === cacheKey) {
        return;
      }

      const pending = leAddressInFlight.get(cacheKey);
      if (pending) {
        await pending;
        return;
      }

      const run = (async () => {
        const nextSeq = get().leAddressFetchSeq + 1;
        set({
          leAddressFetchSeq: nextSeq,
          legalEntityCheckoutAddressLoading: true,
          legalEntityCheckoutAddresses: undefined,
        });
        try {
          const list = await fetchLegalEntityCheckoutAddresses();
          if (get().leAddressFetchSeq !== nextSeq) {
            return;
          }
          set({
            legalEntityCheckoutAddresses: list,
            legalEntityCheckoutAddressesLoadedForKey: cacheKey,
          });
        } catch {
          if (get().leAddressFetchSeq !== nextSeq) {
            return;
          }
          set({
            legalEntityCheckoutAddresses: [],
            legalEntityCheckoutAddressesLoadedForKey: cacheKey,
          });
        } finally {
          if (get().leAddressFetchSeq === nextSeq) {
            set({ legalEntityCheckoutAddressLoading: false });
          }
          leAddressInFlight.delete(cacheKey);
        }
      })();

      leAddressInFlight.set(cacheKey, run);
      await run;
    },

    invalidateLegalEntityCheckoutAddresses: () => {
      leAddressInFlight.clear();
      set((s) => ({
        legalEntityCheckoutAddresses: undefined,
        legalEntityCheckoutAddressesLoadedForKey: null,
        legalEntityCheckoutAddressLoading: false,
        leAddressFetchSeq: s.leAddressFetchSeq + 1,
      }));
    },

    reset: () => set(defaultState),
  }));
};
