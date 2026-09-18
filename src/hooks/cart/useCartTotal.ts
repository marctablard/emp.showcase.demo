'use client';

import { buildCheckoutOrderSummaryFromCart } from '@/lib/common/checkout-order-summary';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { useSelectedShippingMethod } from '../checkout/useSelectedShippingMethod';
import { useSession } from '../session/useSession';
import { useSite } from '../site/useSite';
import { useCart } from './useCart';

interface UseCartTotal {
  /** Cart `calculatedPrice` total, with the picked checkout shipping fee overlaid when it differs. */
  cartTotal: number;
  /**
   * Goods gross on the same basis as `goodsNet` / `goodsVat`: discounted when a goods coupon
   * applied, otherwise `cart.subTotalPrice`.
   */
  goodsGross: number;
  /** Goods net after coupons when `goodsDiscountedNet` is present; otherwise `cart.tax.netValue`. */
  goodsNet: number;
  /** Goods VAT after coupons when `goodsDiscountedVat` is present; otherwise `cart.tax.amount`. */
  goodsVat: number;
  /** Cart shipping net, or the picked checkout method fee when it differs. */
  shippingCosts?: number;
  shippingVat: number;
  showShippingVat: boolean;
  currency: string;
}

function displayGoodsGross(
  breakdown: ReturnType<typeof buildCheckoutOrderSummaryFromCart>,
  cartSubtotal: number | undefined,
): number {
  if (breakdown.hasAppliedCoupons === true && breakdown.goodsDiscounted === true) {
    if (typeof breakdown.goodsDiscountedGross === 'number') {
      return breakdown.goodsDiscountedGross;
    }
    return Math.round((breakdown.goodsNet + breakdown.goodsVat) * 100) / 100;
  }
  return cartSubtotal ?? 0;
}

export const useCartTotal = (): UseCartTotal => {
  const { cart } = useCart();
  const selectedShipping = useSelectedShippingMethod();
  const { session } = useSession();
  const { site } = useSite();

  const breakdown = buildCheckoutOrderSummaryFromCart(cart, selectedShipping);
  const cartTotal = breakdown.total;
  const goodsGross = displayGoodsGross(breakdown, cart?.subTotalPrice?.amount);
  const goodsNet = breakdown.goodsNet;
  const goodsVat = breakdown.goodsVat;
  const shippingCosts = breakdown.shippingFee;
  const shippingVat = breakdown.shippingVat;
  const showShippingVat = breakdown.showShippingVat;
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

  return {
    cartTotal,
    goodsGross,
    goodsNet,
    goodsVat,
    shippingCosts,
    shippingVat,
    showShippingVat,
    currency,
  };
};
