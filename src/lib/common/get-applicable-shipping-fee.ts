export type ShippingFeeCandidate = {
  minOrderValue: { amount: number };
  cost: { amount: number };
};

/**
 * COP-6407: fee with the highest `minOrderValue` that is still ≤ `subtotal`.
 * Does not mutate `fees`. Empty / missing fees return `undefined`; if no tier
 * is eligible, falls back to the first fee.
 */
export function getApplicableShippingFee<T extends ShippingFeeCandidate>(
  fees: readonly T[] | null | undefined,
  subtotal: number,
): T | undefined {
  if (!fees || fees.length === 0) {
    return undefined;
  }

  const eligible = fees.filter((fee) => fee.minOrderValue.amount <= subtotal);
  if (eligible.length === 0) {
    return fees[0];
  }

  return [...eligible].sort((left, right) => right.minOrderValue.amount - left.minOrderValue.amount)[0];
}
