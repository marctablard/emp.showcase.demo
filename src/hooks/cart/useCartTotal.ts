'use client';

import { useCheckout } from '../checkout/useCheckout';
import { useCart } from './useCart';

interface UseCartTotal {
  cartTotal: number;
  shippingCosts?: number;
  currency: string;
}

export const useCartTotal = (): UseCartTotal => {
  const { shippingMethod } = useCheckout();
  const { cart } = useCart();

  const subtotalAmount = cart?.subTotalPrice?.amount ?? 0;
  const shippingAmount = shippingMethod?.amount ?? 0;
  const cartTotal = subtotalAmount > 0 ? subtotalAmount + shippingAmount : 0;

  return {
    cartTotal,
    shippingCosts: shippingMethod?.amount,
    currency: cart?.totalPrice?.currency ?? 'EUR',
  };
};
