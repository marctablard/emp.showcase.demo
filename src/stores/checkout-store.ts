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

interface CheckoutActions {
  // Checkout operations
  setCart: (cart: Cart) => void;
  getCart: () => Cart | null;
  reset: () => void;
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
        reset: () => {
          set({
            cart: null,
            contactData: null,
            shippingAddress: null,
            billingAddress: null,
            paymentMethod: null,
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
