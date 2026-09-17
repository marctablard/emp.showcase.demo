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

/**
 * Goods savings for confirmation / dashboard totals.
 * Prefer published `savingsTotal` so a `TOTAL` rollup plus coupon rows is not added twice.
 */
export function orderGoodsSavings(
  order: { savingsTotal?: number; discounts?: OrderDiscount[]; currency?: string } | null | undefined,
): { amount: number; currency: string } | undefined {
  if (!order) {
    return undefined;
  }
  const currency = order.discounts?.find((discount) => discount.currency)?.currency ?? order.currency ?? '';
  const facing = shopperFacingOrderPromos(order.discounts);
  const goodsPromos = facing.filter((discount) => !isFreeShippingPromo(discount));
  if (facing.length > 0 && goodsPromos.length === 0) {
    return undefined;
  }
  if (typeof order.savingsTotal === 'number' && order.savingsTotal > 0) {
    return { amount: order.savingsTotal, currency };
  }
  const amount = goodsPromos.reduce((sum, discount) => sum + (discount.value || 0), 0);
  if (amount <= 0) {
    return undefined;
  }
  return { amount, currency };
}

function isRemovableCartPromo(discount: CartAppliedDiscount): boolean {
  const code = discount.code.trim();
  return code.length > 0 && !AGGREGATE_PROMO_CODES.has(code);
}

/** Codes that still live on the cart (including zero-effect) — used in toasts, not TOTAL. */
export function cartCouponCodesForMessage(discounts: CartAppliedDiscount[] | undefined): string[] {
  return [...new Set((discounts ?? []).filter(isRemovableCartPromo).map((discount) => discount.code.trim()))];
}

/** DELETE indexes for real coupons, highest first so later removals do not shift earlier ones. */
export function removableCartDiscountIndexes(discounts: CartAppliedDiscount[] | undefined): number[] {
  return (discounts ?? [])
    .filter(isRemovableCartPromo)
    .map((discount) => discount.discountIndex)
    .sort((left, right) => right - left);
}
