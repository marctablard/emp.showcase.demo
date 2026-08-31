import { type ShippingFeeCandidate, getApplicableShippingFee } from './get-applicable-shipping-fee';

/** New Shipping 7% tiers from COP-6407 / Q1000510. */
function newShipping7Fees(): ShippingFeeCandidate[] {
  return [
    { minOrderValue: { amount: 0 }, cost: { amount: 10 } },
    { minOrderValue: { amount: 20 }, cost: { amount: 5 } },
    { minOrderValue: { amount: 100 }, cost: { amount: 20 } },
  ];
}

describe('getApplicableShippingFee', () => {
  it('returns the highest matching tier for a subtotal above 8,000 (Q1000510: 20 EUR, not 5)', () => {
    expect(getApplicableShippingFee(newShipping7Fees(), 8000)?.cost.amount).toBe(20);
  });

  it('returns 10 EUR below the 20 EUR tier', () => {
    expect(getApplicableShippingFee(newShipping7Fees(), 19.99)?.cost.amount).toBe(10);
  });

  it('returns 5 EUR between 20 and 99.99', () => {
    expect(getApplicableShippingFee(newShipping7Fees(), 20)?.cost.amount).toBe(5);
    expect(getApplicableShippingFee(newShipping7Fees(), 99.99)?.cost.amount).toBe(5);
  });

  it('returns 20 EUR at and above the 100 EUR tier', () => {
    expect(getApplicableShippingFee(newShipping7Fees(), 100)?.cost.amount).toBe(20);
  });

  it('uses the 0 EUR tier at an exact 0 boundary', () => {
    expect(getApplicableShippingFee(newShipping7Fees(), 0)?.cost.amount).toBe(10);
  });

  it('picks the highest matching minOrderValue when fees are unsorted', () => {
    const unsorted: ShippingFeeCandidate[] = [
      { minOrderValue: { amount: 100 }, cost: { amount: 20 } },
      { minOrderValue: { amount: 0 }, cost: { amount: 10 } },
      { minOrderValue: { amount: 20 }, cost: { amount: 5 } },
    ];

    expect(getApplicableShippingFee(unsorted, 8000)?.cost.amount).toBe(20);
    expect(getApplicableShippingFee(unsorted, 50)?.cost.amount).toBe(5);
    expect(getApplicableShippingFee(unsorted, 10)?.cost.amount).toBe(10);
  });

  it('returns undefined when fees are missing or empty', () => {
    expect(getApplicableShippingFee(undefined, 8000)).toBeUndefined();
    expect(getApplicableShippingFee(null, 8000)).toBeUndefined();
    expect(getApplicableShippingFee([], 8000)).toBeUndefined();
  });

  it('falls back to the first fee when no tier is eligible', () => {
    const fees: ShippingFeeCandidate[] = [
      { minOrderValue: { amount: 50 }, cost: { amount: 10 } },
      { minOrderValue: { amount: 100 }, cost: { amount: 20 } },
    ];

    expect(getApplicableShippingFee(fees, 10)).toEqual(fees[0]);
  });

  it('does not mutate the input fees array', () => {
    const fees = newShipping7Fees();
    const snapshot = structuredClone(fees);

    getApplicableShippingFee(fees, 8000);

    expect(fees).toEqual(snapshot);
  });
});
