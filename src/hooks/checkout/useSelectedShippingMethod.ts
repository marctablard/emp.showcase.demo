'use client';

import type { SelectedShippingOverlay } from '@/lib/common/checkout-order-summary';
import { useCheckoutStore } from '@/providers/StoreProvider';

/**
 * Reads the checkout-store shipping method without `useCheckout` effects.
 * Header / mini-cart must use this — mounting `useCheckout` on hover used to
 * clear methods and flicker totals.
 */
export function useSelectedShippingMethod(): SelectedShippingOverlay | null {
  const { shippingMethod } = useCheckoutStore();
  if (!shippingMethod || !Number.isFinite(shippingMethod.amount)) {
    return null;
  }
  return { amount: shippingMethod.amount };
}
