import {
  resolveSharedPositiveTaxRate,
  resolveSingleNumericRate,
  resolveSingleTaxRate,
  uniqueTaxRates,
} from './tax-aggregate';

describe('tax-aggregate', () => {
  it('returns a single rate when all lines share it', () => {
    expect(resolveSingleTaxRate([{ name: 'STANDARD', rate: 19, amount: 10, taxable: 50 }])).toBe(19);
    expect(uniqueTaxRates([{ rate: 19 }, { rate: 19 }])).toEqual([19]);
  });

  it('returns undefined when STANDARD and REDUCED differ', () => {
    expect(
      resolveSingleTaxRate([
        { name: 'STANDARD', rate: 19, amount: 31.35, taxable: 196.35 },
        { name: 'REDUCED', rate: 7, amount: 545.79, taxable: 8342.79 },
      ]),
    ).toBeUndefined();
  });

  it('returns undefined for empty or missing lines', () => {
    expect(resolveSingleTaxRate(undefined)).toBeUndefined();
    expect(resolveSingleTaxRate([])).toBeUndefined();
  });

  it('resolves a single numeric rate from item rates', () => {
    expect(resolveSingleNumericRate([19, 19, undefined])).toBe(19);
    expect(resolveSingleNumericRate([19, 7])).toBeUndefined();
    expect(resolveSingleNumericRate([])).toBeUndefined();
  });

  it('resolves a shared positive item rate without using taxAggregate', () => {
    expect(resolveSharedPositiveTaxRate([7.7, 7.7])).toBe(7.7);
    expect(resolveSharedPositiveTaxRate([19, 7])).toBeUndefined();
    expect(resolveSharedPositiveTaxRate([0, 0])).toBeUndefined();
    expect(resolveSharedPositiveTaxRate([19.012, 18.988])).toBe(19);
  });
});
