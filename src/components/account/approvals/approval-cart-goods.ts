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
 * - `totalPrice.netValue` — charged total. It matches the goods subtotal when shipping is
 *   stored only on `details.shipping`. Otherwise it includes shipping net
 *   (fixture: 1,194.79 goods + 11 shipping = 1,205.79).
 *
 * Peel shipping off only when the charged net is not already the goods subtotal. A matching
 * total next to shipping details is goods-only and must not become a fake coupon. A different
 * total includes shipping, so a coupon smaller than shipping is still detected and a larger
 * coupon does not fold shipping into the goods net or savings.
 */
export function resolveApprovalCartGoods(approval: Approval, lineGoodsNet: number): ApprovalCartGoodsDisplay {
  const aggregate = approval.resource.subtotalAggregate;
  const subTotal = approval.resource.subTotalPrice;
  const originalNet = aggregate?.netValue ?? subTotal?.netValue ?? lineGoodsNet;
  const originalVat = aggregate?.taxValue ?? subTotal?.taxValue ?? 0;
  const shipping = approval.details?.shipping;
  const shippingAmount = shippingNet(shipping);
  const chargedNetRaw = approval.resource.totalPrice?.netValue;
  const chargedVatRaw = approval.resource.totalPrice?.taxValue;
  const chargedIncludesShipping =
    typeof chargedNetRaw === 'number' && shippingAmount > 0 && Math.abs(chargedNetRaw - originalNet) >= 0.005;
  const shippingNetInTotal = chargedIncludesShipping ? shippingAmount : 0;
  const shippingVatInTotal = chargedIncludesShipping ? shippingVat(shipping) : 0;
  const chargedGoodsNet = typeof chargedNetRaw === 'number' ? round2(chargedNetRaw - shippingNetInTotal) : undefined;
  const chargedGoodsVat = typeof chargedVatRaw === 'number' ? round2(chargedVatRaw - shippingVatInTotal) : undefined;
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
