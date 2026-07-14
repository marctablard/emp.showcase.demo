'use client';

import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { useCheckout } from '../checkout/useCheckout';
import { useSession } from '../session/useSession';
import { useSite } from '../site/useSite';
import { useCart } from './useCart';

interface UseCartTotal {
  cartTotal: number;
  shippingCosts?: number;
  discountAmount?: number;
  feesAmount?: number;
  currency: string;
}

export const useCartTotal = (): UseCartTotal => {
  const { shippingMethod } = useCheckout();
  const { cart } = useCart();
  const { session } = useSession();
  const { site } = useSite();

  const discountAmount = cart?.totalDiscount?.amount ?? 0;
  const feesAmount = cart?.fees?.amount ?? 0;
  const cartShippingAmount = cart?.shippingCosts?.amount;
  const hasSelectedShipping = shippingMethod != null;
  const shippingAmount = hasSelectedShipping ? shippingMethod.amount : undefined;

  const supportedSiteCurrencies = new Set(
    site?.currencies?.flatMap((currency) => [currency.id, currency.code].filter(Boolean) as string[]) ?? [],
  );
  const sessionCurrency = session?.currency;
  const sessionBackedCurrency =
    sessionCurrency && (supportedSiteCurrencies.size === 0 || supportedSiteCurrencies.has(sessionCurrency))
      ? sessionCurrency
      : undefined;
  const fallbackCurrency = sessionBackedCurrency ?? site?.defaultCurrency?.id ?? getPublicDefaultCurrency();
  const cartCurrency = cart?.totalPrice?.currency;
  const currency =
    sessionBackedCurrency && cartCurrency && cartCurrency !== sessionBackedCurrency
      ? sessionBackedCurrency
      : (cartCurrency ?? fallbackCurrency);

  let cartTotal = 0;
  if (cart?.totalPrice?.amount) {
    if (hasSelectedShipping) {
      const includedShipping = cartShippingAmount ?? 0;
      if (shippingMethod.amount !== includedShipping) {
        cartTotal = cart.totalPrice.amount - includedShipping + shippingMethod.amount;
      } else {
        cartTotal = cart.totalPrice.amount;
      }
    } else if (cartShippingAmount !== undefined && cartShippingAmount > 0) {
      cartTotal = cart.totalPrice.amount - cartShippingAmount;
    } else {
      cartTotal = cart.totalPrice.amount;
    }
  } else {
    const subtotalAmount = cart?.subTotalPrice?.amount ?? 0;
    cartTotal = Math.max(0, subtotalAmount - discountAmount + feesAmount + (shippingAmount ?? 0));
  }

  return {
    cartTotal,
    shippingCosts: shippingAmount,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    feesAmount: feesAmount > 0 ? feesAmount : undefined,
    currency,
  };
};
