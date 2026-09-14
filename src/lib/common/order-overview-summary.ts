import { shouldDisplayTaxLine } from '@/components/account/shared/detail-tax-line';
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
  | 'discounts'
> {
  const savingsFields = typeof order?.savingsTotal === 'number' ? { savingsTotal: order.savingsTotal } : {};
  const discountFields = order?.discounts?.length ? { discounts: order.discounts } : {};

  if (order?.totalDiscountCalculationType === 'ApplyDiscountAfterTax') {
    return {
      hasAppliedCoupons: true,
      couponApplyBasis: 'gross',
      originalGoodsNet,
      originalGoodsVat: order.price?.subtotal.tax ?? 0,
      originalGoodsGross: order.price?.subtotal.gross ?? 0,
      ...savingsFields,
      ...discountFields,
      ...(typeof order.goodsDiscountedGross === 'number' ? { goodsDiscountedGross: order.goodsDiscountedGross } : {}),
    };
  }

  return {
    hasAppliedCoupons: true,
    couponApplyBasis: 'net',
    originalGoodsNet,
    ...savingsFields,
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

  return {
    goodsNet,
    goodsVat,
    shippingFee: order?.shipping?.total.value,
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
