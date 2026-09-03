'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Cart } from '@/platform/services/model/cart/cart';
import type {
  CheckoutAddress,
  CheckoutPaymentMethod,
  ContactData,
  OrderShipping,
} from '@/platform/services/model/checkout/checkout';

export interface CheckoutState {
  // Cart data
  cart: Cart | null;
  contactData: ContactData | null;
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  paymentMethod: CheckoutPaymentMethod | null;
  shippingMethod: OrderShipping | null;
}

export type CheckoutResetOptions = {
  /** Keep buyer addresses (and payment/contact) for the next cart after an order, approval, or quote. */
  keepAddresses?: boolean;
};

interface CheckoutActions {
  // Checkout operations
  setCart: (cart: Cart) => void;
  getCart: () => Cart | null;
  reset: (options?: CheckoutResetOptions) => void;
  setContactData: (contactData: ContactData | null) => void;
  setShippingAddress: (address: CheckoutAddress | null) => void;
  setBillingAddress: (address: CheckoutAddress | null) => void;
  setPaymentMethod: (paymentMethod: CheckoutPaymentMethod | null) => void;
  setShippingMethod: (shippingMethod: OrderShipping | null) => void;
}

export type CheckoutStore = CheckoutState & CheckoutActions;

const defaultState: CheckoutState = {
  cart: null,
  contactData: null,
  shippingAddress: null,
  billingAddress: null,
  paymentMethod: null,
  shippingMethod: null,
};

export const createCheckoutStore = (initState: CheckoutState = defaultState) => {
  return create<CheckoutStore>()(
    persist(
      (set, get) => ({
        ...initState,
        setCart: (cart: Cart) => {
          set({ cart });
        },
        getCart: () => get().cart,
        reset: (options?: CheckoutResetOptions) => {
          const keepAddresses = options?.keepAddresses === true;
          set({
            cart: null,
            contactData: keepAddresses ? get().contactData : null,
            shippingAddress: keepAddresses ? get().shippingAddress : null,
            billingAddress: keepAddresses ? get().billingAddress : null,
            paymentMethod: keepAddresses ? get().paymentMethod : null,
            // Always drop the method — a new cart needs fresh findSite rates.
            shippingMethod: null,
          });
        },
        setContactData: (contactData: ContactData | null) => {
          set({ contactData });
        },
        setShippingAddress: (address: CheckoutAddress | null) => {
          set({ shippingAddress: address });
        },
        setBillingAddress: (address: CheckoutAddress | null) => {
          set({ billingAddress: address });
        },
        setPaymentMethod: (paymentMethod: CheckoutPaymentMethod | null) => {
          set({ paymentMethod });
        },
        setShippingMethod: (shippingMethod: OrderShipping | null) => {
          set({ shippingMethod });
        },
      }),
      {
        name: 'emp-checkout',
        storage: createJSONStorage(() => sessionStorage),
      },
    ),
  );
};
