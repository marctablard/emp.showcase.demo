import type { Approval } from '@/platform/services/model/approval';

export type ApprovalCartGoodsDisplay = {
  /** Pre-coupon goods net. Same figure as “Original value of goods” when a coupon lowered it. */
  originalNet: number;
  /** Goods net shown as “Net value of goods”. Post-coupon when `discounted` is true. */
  net: number;
  vat: number;
  discounted: boolean;
  savings?: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * CART approval Order Overview goods rows.
 *
 * Approval GET does not return `discounts[]` or a coupon code. The snapshot still
 * separates the figures checkout uses:
 * - `subtotalAggregate` / line nets — goods before the coupon
 * - `totalPrice` — charged goods after the coupon (shipping stays on `details.shipping`)
 *
 * A lower `totalPrice.netValue` is the coupon. A higher one is shipping inside the
 * total, not a saving (do not strike the goods row).
 */
export function resolveApprovalCartGoods(approval: Approval, lineGoodsNet: number): ApprovalCartGoodsDisplay {
  const aggregate = approval.resource.subtotalAggregate;
  const subTotal = approval.resource.subTotalPrice;
  const originalNet = aggregate?.netValue ?? subTotal?.netValue ?? lineGoodsNet;
  const originalVat = aggregate?.taxValue ?? subTotal?.taxValue ?? 0;
  const chargedNet = approval.resource.totalPrice?.netValue;
  const chargedVat = approval.resource.totalPrice?.taxValue;
  const discounted = typeof chargedNet === 'number' && originalNet - chargedNet >= 0.005;

  if (!discounted || typeof chargedNet !== 'number') {
    return {
      originalNet,
      net: lineGoodsNet > 0 ? lineGoodsNet : originalNet,
      vat: originalVat,
      discounted: false,
    };
  }

  return {
    originalNet,
    net: chargedNet,
    vat: typeof chargedVat === 'number' ? chargedVat : originalVat,
    discounted: true,
    savings: round2(originalNet - chargedNet),
  };
}
