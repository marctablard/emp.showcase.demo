import { shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
import {
  isFreeShippingPromo,
  optionalSavingsTotal,
  resolveGoodsSavingsAmount,
} from '@/lib/common/applied-promo-display';
import type { Order, OrderDiscount } from '@/platform/services/model/order/order';

export type CouponApplyBasis = 'net' | 'gross';

export type OrderOverviewSummaryBreakdown = {
  goodsNet: number;
  goodsVat: number;
  shippingFee: number | undefined;
  shippingVat: number;
  showShippingVat: boolean;
  total: number;
  currency: string;
  hasAppliedCoupons?: boolean;
  couponApplyBasis?: CouponApplyBasis;
  originalGoodsNet?: number;
  originalGoodsVat?: number;
  originalGoodsGross?: number;
  savingsTotal?: number;
  goodsDiscountedGross?: number;
  /**
   * Whether applied coupons lowered the goods value. False for a free-shipping-only
   * order so Overview must not strike through an unchanged goods figure.
   */
  goodsDiscounted?: boolean;
  /** A coupon waives shipping — "Your savings" belongs on the shipping row, not goods. */
  shippingFree?: boolean;
  /**
   * Sum of shipping method list fees (`shipping.lines[].amount`) when that is higher than the
   * discounted `totalShipping` net. Order API publishes one discounted total plus the method fee.
   */
  shippingListFee?: number;
  discounts?: OrderDiscount[];
};

function orderHasAppliedCoupons(order: Order | null | undefined): boolean {
  if (!order) {
    return false;
  }
  if ((order.discounts?.length ?? 0) > 0) {
    return true;
  }
  return typeof order.savingsTotal === 'number' && order.savingsTotal > 0;
}

function isLowerThan(candidate: number | undefined, reference: number): boolean {
  return typeof candidate === 'number' && reference - candidate >= 0.005;
}

/**
 * List shipping fee from order method lines when the published shipping total is lower.
 * `shipping.lines[].amount` is the method fee; `calculatedPrice.totalShipping.netValue` is the
 * fee after a TOTAL-base coupon. There is no separate strikethrough field.
 */
export function orderShippingListFee(shipping: Order['shipping'] | undefined): number | undefined {
  const discounted = shipping?.total.value;
  if (typeof discounted !== 'number') {
    return undefined;
  }
  const listFee = (shipping?.methods ?? []).reduce((sum, method) => {
    return typeof method.price === 'number' ? sum + method.price : sum;
  }, 0);
  if (listFee - discounted < 0.005) {
    return undefined;
  }
  return Math.round(listFee * 100) / 100;
}

function orderHasFreeShipping(order: Order | null | undefined): boolean {
  return (order?.discounts ?? []).some((discount) => isFreeShippingPromo(discount));
}

function appliedCouponBreakdownFields(
  order: Order | null | undefined,
  originalGoodsNet: number,
): Pick<
  OrderOverviewSummaryBreakdown,
  | 'hasAppliedCoupons'
  | 'couponApplyBasis'
  | 'originalGoodsNet'
  | 'originalGoodsVat'
  | 'originalGoodsGross'
  | 'savingsTotal'
  | 'goodsDiscountedGross'
  | 'goodsDiscounted'
  | 'shippingFree'
  | 'discounts'
> {
  const discountFields = order?.discounts?.length ? { discounts: order.discounts } : {};
  const shippingFree = orderHasFreeShipping(order);
  const shippingFields = shippingFree ? { shippingFree: true } : {};

  if (order?.totalDiscountCalculationType === 'ApplyDiscountAfterTax') {
    const originalGoodsGross = order.price?.subtotal.gross ?? 0;
    const goodsSavings = resolveGoodsSavingsAmount({
      savingsTotal: order.savingsTotal,
      shippingFree,
      discountedNet: order.goodsDiscountedNet,
      discountedGross: order.goodsDiscountedGross,
      originalNet: originalGoodsNet,
      originalGross: originalGoodsGross,
      afterTax: true,
    });
    return {
      hasAppliedCoupons: true,
      couponApplyBasis: 'gross',
      originalGoodsNet,
      originalGoodsVat: order.price?.subtotal.tax ?? 0,
      originalGoodsGross,
      goodsDiscounted: isLowerThan(order.goodsDiscountedGross, originalGoodsGross),
      ...optionalSavingsTotal(goodsSavings),
      ...shippingFields,
      ...discountFields,
      ...(typeof order.goodsDiscountedGross === 'number' ? { goodsDiscountedGross: order.goodsDiscountedGross } : {}),
    };
  }

  const goodsSavings = resolveGoodsSavingsAmount({
    savingsTotal: order?.savingsTotal,
    shippingFree,
    discountedNet: order?.goodsDiscountedNet,
    originalNet: originalGoodsNet,
  });
  return {
    hasAppliedCoupons: true,
    couponApplyBasis: 'net',
    originalGoodsNet,
    goodsDiscounted: isLowerThan(order?.goodsDiscountedNet, originalGoodsNet),
    ...optionalSavingsTotal(goodsSavings),
    ...shippingFields,
    ...discountFields,
  };
}

/**
 * Display-only Order Overview totals from mapped `Order` published fields.
 * Apply ≠ redeem — this helper does not apply or remove coupons.
 */
export function buildOrderOverviewBreakdown(order: Order | null | undefined): OrderOverviewSummaryBreakdown {
  const hasAppliedCoupons = orderHasAppliedCoupons(order);
  const originalGoodsNet = order?.price?.subtotal.net ?? 0;
  const goodsNet =
    hasAppliedCoupons && typeof order?.goodsDiscountedNet === 'number' ? order.goodsDiscountedNet : originalGoodsNet;
  const goodsVat =
    hasAppliedCoupons && typeof order?.goodsDiscountedVat === 'number'
      ? order.goodsDiscountedVat
      : (order?.price?.subtotal.tax ?? 0);
  const shippingVat = order?.shipping?.total.tax ?? 0;
  const shippingListFee = orderShippingListFee(order?.shipping);

  return {
    goodsNet,
    goodsVat,
    shippingFee: order?.shipping?.total.value,
    ...(shippingListFee !== undefined ? { shippingListFee } : {}),
    shippingVat,
    showShippingVat: shouldDisplayTaxLine({
      taxRate: order?.shipping?.total.taxRate,
      taxAmount: shippingVat,
    }),
    total: order?.price?.total.gross ?? 0,
    currency: order?.price?.subtotal.currency ?? order?.price?.total.currency ?? order?.currency ?? '',
    ...(hasAppliedCoupons ? appliedCouponBreakdownFields(order, originalGoodsNet) : {}),
  };
}
