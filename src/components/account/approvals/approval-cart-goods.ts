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

const MONEY_EPSILON = 0.005;

function closeMoney(left: number, right: number): boolean {
  return Math.abs(left - right) < MONEY_EPSILON;
}

/**
 * Shipping sits inside `totalPrice` only when the numbers say so.
 * A goods-only net cannot exceed the pre-coupon subtotal, so a higher charged net includes
 * shipping (fixture: 1,194.79 + 11 = 1,205.79), including a coupon smaller than shipping.
 * A lower charged net is already the post-coupon goods figure when it matches `gross − tax`.
 * It includes shipping only when gross/tax stay on the goods and the net is that goods net
 * plus `details.shipping.amount` — CART gross excludes shipping.
 */
function shippingInsideChargedTotal(
  chargedNet: number,
  originalNet: number,
  shippingAmount: number,
  shippingVatAmount: number,
  chargedGross: number | undefined,
  chargedVat: number | undefined,
): { net: number; vat: number } {
  if (shippingAmount <= 0) {
    return { net: 0, vat: 0 };
  }
  if (chargedNet - originalNet >= MONEY_EPSILON) {
    return { net: shippingAmount, vat: shippingVatAmount };
  }
  if (typeof chargedGross !== 'number' || typeof chargedVat !== 'number') {
    return { net: 0, vat: 0 };
  }

  const goodsNetWhenTaxExcludesShipping = round2(chargedGross - chargedVat);
  if (
    closeMoney(chargedNet, goodsNetWhenTaxExcludesShipping + shippingAmount) &&
    !closeMoney(chargedNet, goodsNetWhenTaxExcludesShipping)
  ) {
    return { net: shippingAmount, vat: 0 };
  }

  if (shippingVatAmount <= 0) {
    return { net: 0, vat: 0 };
  }
  const goodsNetWhenTaxIncludesShipping = round2(chargedGross - (chargedVat - shippingVatAmount));
  if (
    closeMoney(chargedNet, goodsNetWhenTaxIncludesShipping + shippingAmount) &&
    !closeMoney(chargedNet, goodsNetWhenTaxIncludesShipping)
  ) {
    return { net: shippingAmount, vat: shippingVatAmount };
  }

  return { net: 0, vat: 0 };
}

/**
 * CART approval Order Overview goods rows.
 *
 * Approval GET does not return `discounts[]` or a coupon code. The snapshot still
 * separates the figures checkout uses:
 * - `subtotalAggregate` / line nets — goods before the coupon
 * - `totalPrice.netValue` — charged total. It matches the goods subtotal when shipping is
 *   stored only on `details.shipping`. Otherwise it can include shipping net
 *   (fixture: 1,194.79 goods + 11 shipping = 1,205.79).
 * - `totalPrice.grossValue` — goods gross; CART shipping is not stored there.
 *
 * Derive the goods charged net/tax before deciding `discounted`. A goods-only discount
 * (charged net below the subtotal, with shipping details beside it) is left unchanged.
 */
export function resolveApprovalCartGoods(approval: Approval, lineGoodsNet: number): ApprovalCartGoodsDisplay {
  const aggregate = approval.resource.subtotalAggregate;
  const subTotal = approval.resource.subTotalPrice;
  const originalNet = aggregate?.netValue ?? subTotal?.netValue ?? lineGoodsNet;
  const originalVat = aggregate?.taxValue ?? subTotal?.taxValue ?? 0;
  const shipping = approval.details?.shipping;
  const chargedNetRaw = approval.resource.totalPrice?.netValue;
  const chargedVatRaw = approval.resource.totalPrice?.taxValue;
  const chargedGrossRaw = approval.resource.totalPrice?.grossValue;
  const included =
    typeof chargedNetRaw === 'number'
      ? shippingInsideChargedTotal(
          chargedNetRaw,
          originalNet,
          shippingNet(shipping),
          shippingVat(shipping),
          chargedGrossRaw,
          chargedVatRaw,
        )
      : { net: 0, vat: 0 };
  const chargedGoodsNet = typeof chargedNetRaw === 'number' ? round2(chargedNetRaw - included.net) : undefined;
  const chargedGoodsVat = typeof chargedVatRaw === 'number' ? round2(chargedVatRaw - included.vat) : undefined;
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
