'use client';

import { useCheckout } from '../checkout/useCheckout';
import { useSession } from '../session/useSession';
import { useSite } from '../site/useSite';
import { useCart } from './useCart';

interface UseCartTotal {
  cartTotal: number;
  shippingCosts?: number;
  currency: string;
}

export const useCartTotal = (): UseCartTotal => {
  const { shippingMethod } = useCheckout();
  const { cart } = useCart();
  const { session } = useSession();
  const { site } = useSite();

  const subtotalAmount = cart?.subTotalPrice?.amount ?? 0;
  const shippingAmount = shippingMethod?.amount ?? 0;
  const cartTotal = subtotalAmount > 0 ? subtotalAmount + shippingAmount : 0;
  const supportedSiteCurrencies = new Set(
    site?.currencies?.flatMap((currency) => [currency.id, currency.code].filter(Boolean) as string[]) ?? [],
  );
  const sessionCurrency = session?.currency;
  const fallbackCurrency =
    sessionCurrency && (supportedSiteCurrencies.size === 0 || supportedSiteCurrencies.has(sessionCurrency))
      ? sessionCurrency
      : site?.defaultCurrency?.id || 'EUR';

  return {
    cartTotal,
    shippingCosts: shippingMethod?.amount,
    currency: cart?.totalPrice?.currency ?? fallbackCurrency,
  };
};
