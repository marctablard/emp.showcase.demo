import type { Approval } from '@/platform/services/model/approval';
import type { OrderShipping } from '@/platform/services/model/checkout';

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

function shippingNet(shipping: OrderShipping | undefined): number {
  return shipping?.amount ?? 0;
}

/** Shipping VAT included in `totalPrice.taxValue` when the snapshot exposes it. */
function shippingVat(shipping: OrderShipping | undefined): number {
  if (!shipping) {
    return 0;
  }
  if (typeof shipping.grossAmount === 'number') {
    return round2(Math.max(0, shipping.grossAmount - shipping.amount));
  }
  if (typeof shipping.taxRate === 'number' && shipping.taxRate > 0) {
    return round2((shipping.amount * shipping.taxRate) / 100);
  }
  return 0;
}

/**
 * CART approval Order Overview goods rows.
 *
 * Approval GET does not return `discounts[]` or a coupon code. The snapshot still
 * separates the figures checkout uses:
 * - `subtotalAggregate` / line nets — goods before the coupon
 * - `totalPrice.netValue` — charged total, which can be goods-only or goods + shipping net
 *   (fixture: 1,194.79 goods + 11 shipping = 1,205.79)
 *
 * Subtract shipping net/VAT before comparing with the goods subtotal. Otherwise a coupon
 * smaller than shipping looks like no discount, and a larger coupon folds shipping into
 * the discounted goods net and savings.
 */
export function resolveApprovalCartGoods(approval: Approval, lineGoodsNet: number): ApprovalCartGoodsDisplay {
  const aggregate = approval.resource.subtotalAggregate;
  const subTotal = approval.resource.subTotalPrice;
  const originalNet = aggregate?.netValue ?? subTotal?.netValue ?? lineGoodsNet;
  const originalVat = aggregate?.taxValue ?? subTotal?.taxValue ?? 0;
  const shipping = approval.details?.shipping;
  const chargedNetRaw = approval.resource.totalPrice?.netValue;
  const chargedVatRaw = approval.resource.totalPrice?.taxValue;
  const chargedGoodsNet = typeof chargedNetRaw === 'number' ? round2(chargedNetRaw - shippingNet(shipping)) : undefined;
  const chargedGoodsVat = typeof chargedVatRaw === 'number' ? round2(chargedVatRaw - shippingVat(shipping)) : undefined;
  const discounted = typeof chargedGoodsNet === 'number' && originalNet - chargedGoodsNet >= 0.005;

  if (!discounted || typeof chargedGoodsNet !== 'number') {
    return {
      originalNet,
      net: lineGoodsNet > 0 ? lineGoodsNet : originalNet,
      vat: originalVat,
      discounted: false,
    };
  }

  return {
    originalNet,
    net: chargedGoodsNet,
    vat: typeof chargedGoodsVat === 'number' ? chargedGoodsVat : originalVat,
    discounted: true,
    savings: round2(originalNet - chargedGoodsNet),
  };
}
