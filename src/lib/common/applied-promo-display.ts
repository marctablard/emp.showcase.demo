import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import type { OrderDiscount } from '@/platform/services/model/order/order';

/** Emporix publishes a rollup row with this code; "Your savings" already shows that total. */
const AGGREGATE_PROMO_CODES = new Set(['TOTAL']);

function hasGoodsEffect(amount: number | undefined): boolean {
  return typeof amount === 'number' && Math.abs(amount) >= 0.005;
}

export function isFreeShippingPromo(discount: { type?: string }): boolean {
  return discount.type === 'FREE_SHIPPING';
}

/**
 * Shopper-facing promo chips: skip the platform `TOTAL` rollup and coupons that changed
 * neither goods nor shipping. Always keep `FREE_SHIPPING` (COP-4815 QA 2026-09-16 / 143688).
 */
export function isShopperFacingCartPromo(discount: CartAppliedDiscount): boolean {
  if (AGGREGATE_PROMO_CODES.has(discount.code)) {
    return false;
  }
  if (isFreeShippingPromo(discount)) {
    return true;
  }
  return hasGoodsEffect(discount.amount);
}

export function isShopperFacingOrderPromo(discount: OrderDiscount): boolean {
  if (AGGREGATE_PROMO_CODES.has(discount.code)) {
    return false;
  }
  if (isFreeShippingPromo(discount)) {
    return true;
  }
  return hasGoodsEffect(discount.value);
}

export function shopperFacingCartPromos(discounts: CartAppliedDiscount[] | undefined): CartAppliedDiscount[] {
  return (discounts ?? []).filter(isShopperFacingCartPromo);
}

export function shopperFacingOrderPromos(discounts: OrderDiscount[] | undefined): OrderDiscount[] {
  return (discounts ?? []).filter(isShopperFacingOrderPromo);
}

/** Codes that still live on the cart (including zero-effect) — used in toasts, not TOTAL. */
export function cartCouponCodesForMessage(discounts: CartAppliedDiscount[] | undefined): string[] {
  return [
    ...new Set(
      (discounts ?? [])
        .map((discount) => discount.code.trim())
        .filter((code) => code.length > 0 && !AGGREGATE_PROMO_CODES.has(code)),
    ),
  ];
}
