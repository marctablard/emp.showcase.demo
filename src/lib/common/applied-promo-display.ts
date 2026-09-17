import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import type { OrderDiscount } from '@/platform/services/model/order/order';

/** Emporix publishes a rollup row with this code; "Your savings" already shows that total. */
const AGGREGATE_PROMO_CODES = new Set(['TOTAL']);

function hasGoodsEffect(amount: number | undefined): boolean {
  return typeof amount === 'number' && Math.abs(amount) >= 0.005;
}

function roundedPositiveDelta(original: number, discounted: number | undefined): number | undefined {
  if (typeof discounted !== 'number' || original - discounted < 0.005) {
    return undefined;
  }
  return Math.round((original - discounted) * 100) / 100;
}

/**
 * Goods-only savings for the "Your savings" badge. Prefer the goods-figure delta so a mixed
 * goods + FREE_SHIPPING order does not include the shipping waiver in the goods total.
 * `savingsTotal` / `shippingFree` stay on the input for callers; they are not a goods fallback
 * when discounted figures are omitted (fee-only rollup, COP-4815 review 5235825162).
 */
export function resolveGoodsSavingsAmount(input: {
  savingsTotal?: number;
  shippingFree?: boolean;
  discountedNet?: number;
  discountedGross?: number;
  originalNet: number;
  originalGross?: number;
  afterTax?: boolean;
}): number | undefined {
  const fromFigures = input.afterTax
    ? roundedPositiveDelta(input.originalGross ?? 0, input.discountedGross)
    : roundedPositiveDelta(input.originalNet, input.discountedNet);
  if (typeof fromFigures === 'number') {
    return fromFigures;
  }
  // Do not treat `savingsTotal` as goods savings when discounted figures are omitted:
  // that rollup can be fee-only (COP-4815 review 5235825162).
  return undefined;
}

export function optionalSavingsTotal(amount: number | undefined): { savingsTotal?: number } {
  if (typeof amount === 'number') {
    return { savingsTotal: amount };
  }
  return {};
}

export function isFreeShippingPromo(discount: { type?: string }): boolean {
  return discount.type === 'FREE_SHIPPING';
}

/**
 * Shopper-facing promo chips: skip the platform `TOTAL` rollup and coupons that changed
 * neither goods nor shipping. Always keep `FREE_SHIPPING` (COP-4815 QA 2026-09-16 / 143688).
 */
export function isShopperFacingCartPromo(discount: CartAppliedDiscount): boolean {
  if (discount.valid === false) {
    return false;
  }
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
  if (goodsPromos.length === 0) {
    return undefined;
  }
  if (facing.some(isFreeShippingPromo) && goodsPromos.length > 0) {
    const mixedGoods = goodsPromos.reduce((sum, discount) => sum + (discount.value || 0), 0);
    return mixedGoods > 0 ? { amount: mixedGoods, currency } : undefined;
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

export function isRemovableCartPromo(discount: CartAppliedDiscount): boolean {
  const code = discount.code.trim();
  return code.length > 0 && !AGGREGATE_PROMO_CODES.has(code);
}

/** Shopper-facing coupon at a DELETE index, or undefined for TOTAL / unknown / empty code. */
export function removableCartPromoAtIndex(
  discounts: CartAppliedDiscount[] | undefined,
  discountIndex: number,
): CartAppliedDiscount | undefined {
  return (discounts ?? []).find(
    (discount) => discount.discountIndex === discountIndex && isRemovableCartPromo(discount),
  );
}

/** Codes that still live on the cart (including invalid) — empty-cart cleanup toasts, not TOTAL. */
export function cartCouponCodesForMessage(discounts: CartAppliedDiscount[] | undefined): string[] {
  return uniqueRemovableCodes(discounts, () => true);
}

/**
 * Codes that can actually block a currency change. Invalid rows are excluded from calculation
 * (COP-4815 review 5236497760) — do not tell the shopper to remove a stale coupon.
 */
export function cartCouponCodesForCurrencyConflict(discounts: CartAppliedDiscount[] | undefined): string[] {
  return uniqueRemovableCodes(discounts, (discount) => discount.valid !== false);
}

function uniqueRemovableCodes(
  discounts: CartAppliedDiscount[] | undefined,
  extra: (discount: CartAppliedDiscount) => boolean,
): string[] {
  return [
    ...new Set(
      (discounts ?? [])
        .filter((discount) => isRemovableCartPromo(discount) && extra(discount))
        .map((discount) => discount.code.trim()),
    ),
  ];
}

/** DELETE indexes for real coupons, highest first so later removals do not shift earlier ones. */
export function removableCartDiscountIndexes(discounts: CartAppliedDiscount[] | undefined): number[] {
  return (discounts ?? [])
    .filter(isRemovableCartPromo)
    .map((discount) => discount.discountIndex)
    .sort((left, right) => right - left);
}

/** Current positional DELETE index for a coupon code, or undefined if that code is gone. */
export function currentDiscountIndexForCode(
  discounts: CartAppliedDiscount[] | undefined,
  code: string | undefined,
): number | undefined {
  if (typeof code !== 'string' || code.length === 0) {
    return undefined;
  }
  const matches = (discounts ?? []).filter((discount) => discount.code === code && isRemovableCartPromo(discount));
  const visible = matches.find((discount) => discount.valid !== false);
  if (visible) {
    return visible.discountIndex;
  }
  return matches[0]?.discountIndex;
}
