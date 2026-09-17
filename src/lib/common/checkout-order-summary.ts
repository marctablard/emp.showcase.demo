import { shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import { optionalSavingsTotal, resolveGoodsSavingsAmount } from '@/lib/common/applied-promo-display';
import type { Cart } from '@/platform/services/model/cart';

export type CheckoutOrderSummaryBreakdown = {
  goodsNet: number;
  goodsVat: number;
  shippingFee: number | undefined;
  shippingVat: number;
  showShippingVat: boolean;
  shippingVatLookupFailed: boolean;
  feesTotal: number;
  total: number;
  currency: string;
  hasAppliedCoupons?: boolean;
  couponApplyBasis?: 'net' | 'gross';
  originalGoodsNet?: number;
  originalGoodsVat?: number;
  originalGoodsGross?: number;
  savingsTotal?: number;
  goodsDiscountedGross?: number;
  /**
   * Whether the applied coupons actually lowered the goods value. False for a free-shipping-only
   * coupon, so the summary must not strike through an unchanged goods figure (COP-5589 QA).
   */
  goodsDiscounted?: boolean;
  /** A coupon waives shipping: `shippingFee` is the picked method's list fee to strike through. */
  shippingFree?: boolean;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildCheckoutOrderSummaryBreakdown(input: {
  goodsNet: number;
  goodsVat: number;
  shippingFee?: number;
  shippingVatRate?: number;
  shippingTaxCodePresent?: boolean;
  feesTotal?: number;
  currency: string;
}): CheckoutOrderSummaryBreakdown {
  const { goodsNet, goodsVat, shippingFee, shippingVatRate, currency } = input;
  const shippingTaxCodePresent = input.shippingTaxCodePresent === true;
  const feesTotal = input.feesTotal ?? 0;
  const shippingVatLookupFailed = shippingTaxCodePresent && shippingVatRate === undefined;

  let shippingVat = 0;
  if (!shippingVatLookupFailed && typeof shippingVatRate === 'number' && shippingFee !== undefined) {
    shippingVat = round2((shippingFee * shippingVatRate) / 100);
  }

  const showShippingVat = shippingVatLookupFailed
    ? false
    : shouldDisplayTaxLine({ taxRate: shippingVatRate, taxAmount: shippingVat });

  return {
    goodsNet,
    goodsVat,
    shippingFee,
    shippingVat,
    showShippingVat,
    shippingVatLookupFailed,
    feesTotal,
    total: round2(goodsNet + goodsVat + (shippingFee ?? 0) + shippingVat + feesTotal),
    currency,
  };
}

/** Checkout-store shipping fee used only for display when it differs from the cart snapshot. */
export type SelectedShippingOverlay = {
  amount: number;
};

function amountsEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.005;
}

function mappedCartShippingGross(cart: Cart): number {
  return cart.shippingCosts?.tax?.grossValue ?? cart.shippingCosts?.amount ?? 0;
}

/**
 * `totalPrice` is already the post-discount final. When shipping is waived the mapper may
 * fall back to pre-discount `shipping` as `shippingCosts` if `totalShipping` is omitted —
 * subtracting that would deduct the fee a second time (COP-4815 review 5235435332).
 */
function cartTotalForDisplay(cart: Cart, shippingFree: boolean): number {
  const total = cart.totalPrice?.amount ?? 0;
  if (shippingFree) {
    return total;
  }
  return round2(total - mappedCartShippingGross(cart));
}

function cartHasAppliedCoupons(cart: Cart | null | undefined): boolean {
  if (!cart) {
    return false;
  }
  if ((cart.discounts?.length ?? 0) > 0) {
    return true;
  }
  return typeof cart.savingsTotal === 'number' && cart.savingsTotal > 0;
}

function isLowerThan(candidate: number | undefined, reference: number): boolean {
  return typeof candidate === 'number' && reference - candidate >= 0.005;
}

function appliedCouponBreakdownFields(
  cart: Cart | null | undefined,
  originalGoodsNet: number,
): Pick<
  CheckoutOrderSummaryBreakdown,
  | 'hasAppliedCoupons'
  | 'couponApplyBasis'
  | 'originalGoodsNet'
  | 'originalGoodsVat'
  | 'originalGoodsGross'
  | 'savingsTotal'
  | 'goodsDiscountedGross'
  | 'goodsDiscounted'
  | 'shippingFree'
> {
  const shippingFree = cart?.freeShipping === true;
  const shippingFields = shippingFree ? { shippingFree: true } : {};

  if (cart?.totalDiscountCalculationType === 'ApplyDiscountAfterTax') {
    const originalGoodsGross = cart.tax?.grossValue ?? 0;
    const goodsSavings = resolveGoodsSavingsAmount({
      savingsTotal: cart.savingsTotal,
      shippingFree,
      discountedNet: cart.goodsDiscountedNet,
      discountedGross: cart.goodsDiscountedGross,
      originalNet: originalGoodsNet,
      originalGross: originalGoodsGross,
      afterTax: true,
    });
    return {
      hasAppliedCoupons: true,
      couponApplyBasis: 'gross',
      originalGoodsNet,
      originalGoodsVat: cart.tax?.amount ?? 0,
      originalGoodsGross,
      goodsDiscounted: isLowerThan(cart.goodsDiscountedGross, originalGoodsGross),
      ...optionalSavingsTotal(goodsSavings),
      ...shippingFields,
      ...(typeof cart.goodsDiscountedGross === 'number' ? { goodsDiscountedGross: cart.goodsDiscountedGross } : {}),
    };
  }

  const goodsSavings = resolveGoodsSavingsAmount({
    savingsTotal: cart?.savingsTotal,
    shippingFree,
    discountedNet: cart?.goodsDiscountedNet,
    originalNet: originalGoodsNet,
  });
  return {
    hasAppliedCoupons: true,
    couponApplyBasis: 'net',
    originalGoodsNet,
    goodsDiscounted: isLowerThan(cart?.goodsDiscountedNet, originalGoodsNet),
    ...optionalSavingsTotal(goodsSavings),
    ...shippingFields,
  };
}

/**
 * Checkout / cart / mini-cart summary from mapped Emporix `calculatedPrice`.
 * When a checkout shipping method is picked and its fee differs from the cart
 * snapshot, overlay that fee on the total — no fee × rate VAT math (avoids flicker).
 */
export function buildCheckoutOrderSummaryFromCart(
  cart: Cart | null | undefined,
  selectedShipping?: SelectedShippingOverlay | null,
): CheckoutOrderSummaryBreakdown {
  const hasAppliedCoupons = cartHasAppliedCoupons(cart);
  const originalGoodsNet = cart?.tax?.netValue ?? 0;
  const goodsNet =
    hasAppliedCoupons && typeof cart?.goodsDiscountedNet === 'number' ? cart.goodsDiscountedNet : originalGoodsNet;
  const goodsVat =
    hasAppliedCoupons && typeof cart?.goodsDiscountedVat === 'number'
      ? cart.goodsDiscountedVat
      : (cart?.tax?.amount ?? 0);
  const shippingVat = cart?.shippingCosts?.tax?.amount ?? 0;
  const fromCart: CheckoutOrderSummaryBreakdown = {
    goodsNet,
    goodsVat,
    shippingFee: cart?.shippingCosts?.amount,
    shippingVat,
    showShippingVat: shouldDisplayTaxLine({
      taxRate: cart?.shippingCosts?.tax?.taxRate,
      taxAmount: shippingVat,
    }),
    shippingVatLookupFailed: false,
    feesTotal: cart?.fees?.amount ?? 0,
    total: cart?.totalPrice?.amount ?? 0,
    currency: cart?.tax?.currency ?? cart?.currency ?? '',
    ...(hasAppliedCoupons ? appliedCouponBreakdownFields(cart, originalGoodsNet) : {}),
    // Mapper can set `freeShipping` from zeroed shipping with no coupon rows
    // (COP-4815 review 5238545021). Keep the flag so a picked method is not
    // added back onto an already waived `totalPrice`.
    ...(cart?.freeShipping === true ? { shippingFree: true } : {}),
  };

  if (!cart) {
    return fromCart;
  }

  // Emporix cart shipping is a minimum estimate until the shopper picks a findSite method.
  // Do not treat that quote as a chosen fee on checkout / cart / mini-cart.
  const shippingFree = fromCart.shippingFree === true;

  if (selectedShipping == null || !Number.isFinite(selectedShipping.amount)) {
    return {
      ...fromCart,
      shippingFee: undefined,
      shippingVat: 0,
      showShippingVat: false,
      total: cartTotalForDisplay(cart, shippingFree),
    };
  }

  // Free-shipping coupon: the cart already carries the waived total. Show the picked
  // method's list fee (struck through) but do not subtract/add shipping again.
  if (shippingFree) {
    return {
      ...fromCart,
      shippingFee: selectedShipping.amount,
      shippingVat: 0,
      showShippingVat: false,
      shippingVatLookupFailed: false,
      total: cartTotalForDisplay(cart, true),
    };
  }

  const cartShippingFee = cart.shippingCosts?.amount ?? 0;
  if (amountsEqual(selectedShipping.amount, cartShippingFee)) {
    return fromCart;
  }

  const shippingFee = selectedShipping.amount;
  return {
    ...fromCart,
    shippingFee,
    shippingVat: 0,
    showShippingVat: false,
    shippingVatLookupFailed: false,
    total: round2((cart.totalPrice?.amount ?? 0) - mappedCartShippingGross(cart) + shippingFee),
  };
}
