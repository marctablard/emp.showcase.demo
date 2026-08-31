'use client';

import {
  type CheckoutOrderSummaryBreakdown,
  buildCheckoutOrderSummaryFromCart,
} from '@/lib/common/checkout-order-summary';
import { useCart } from '../cart/useCart';
import { useSelectedShippingMethod } from './useSelectedShippingMethod';

/**
 * Same overlay as header mini-cart (`useCartTotal`): cart `calculatedPrice`,
 * then the picked checkout shipping fee when it differs. Does not call
 * `useCheckout` — those effects must not remount on hover.
 */
export function useCheckoutOrderSummary(): CheckoutOrderSummaryBreakdown {
  const { cart } = useCart();
  const selectedShipping = useSelectedShippingMethod();
  return buildCheckoutOrderSummaryFromCart(cart, selectedShipping);
}
