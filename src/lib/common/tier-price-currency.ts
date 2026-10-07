import type { ProductPrice } from '@/platform/services/model/price';

/**
 * The matched-price API converts base/effective/total amounts into the requested session
 * currency, but `tierValues` stay in the price list's original currency and carry no
 * currency of their own (`EmporixTierValue` = id + priceValue). When the base tier no
 * longer matches the price's original amount, the tier amounts belong to another currency —
 * rendering them would label foreign amounts with the session's currency symbol
 * (e.g. EUR 130.00 shown as $130.00 next to a correct $115.27 base price).
 */
export function tierValuesMatchPriceCurrency(price: ProductPrice): boolean {
  const tiers = price.tierValues;
  if (!tiers || tiers.length === 0) {
    return false;
  }
  const base = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)[0];
  const originalAmount = price.originalAmount;
  if (typeof originalAmount !== 'number' || originalAmount <= 0 || !Number.isFinite(originalAmount)) {
    return false;
  }
  if (!Number.isFinite(base.price)) {
    return false;
  }
  return Math.abs(base.price - originalAmount) / originalAmount < 0.005;
}
