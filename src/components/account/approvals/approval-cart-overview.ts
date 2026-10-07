import type { Approval } from '@/platform/services/model/approval';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * CART Order Overview “Total value of goods”: `resource.totalPrice.grossValue` only.
 * Approval Service does not store CART shipping in that snapshot.
 * Do not fall back to `totalPrice.amount` — that field is often net (e.g. 170 vs 182.29).
 */
export function resolveCartOrderOverviewTotalGross(approval: Approval): number | undefined {
  const gross = approval.resource.totalPrice?.grossValue;
  return typeof gross === 'number' ? gross : undefined;
}

/**
 * Frontend-estimated shipping tax for CART Order Overview:
 * `totalPrice.grossValue − shipping fee − net value of goods − VAT`.
 * Hidden when shipping is free (no VAT line), the remainder is ≤ 0, or `grossValue` is missing.
 */
export function resolveCartOrderOverviewShippingTax(input: {
  totalGross?: number;
  shippingFee: number;
  goodsNet: number;
  goodsVat: number;
}): { shippingTaxEstimated: number; showShippingTaxEstimated: boolean } {
  const { totalGross, shippingFee, goodsNet, goodsVat } = input;
  if (typeof totalGross !== 'number' || shippingFee <= 0) {
    return { shippingTaxEstimated: 0, showShippingTaxEstimated: false };
  }

  const shippingTaxEstimated = round2(totalGross - shippingFee - goodsNet - goodsVat);
  return {
    shippingTaxEstimated,
    showShippingTaxEstimated: shippingTaxEstimated > 0,
  };
}
