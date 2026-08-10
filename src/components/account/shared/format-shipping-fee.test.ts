import { formatShippingFeeDisplay } from './format-shipping-fee';

describe('formatShippingFeeDisplay', () => {
  const fmt = (n: number) => `€${n.toFixed(2)}`;

  it('returns Free when amount is 0, null, or undefined', () => {
    expect(formatShippingFeeDisplay(0, fmt, 'Free')).toBe('Free');
    expect(formatShippingFeeDisplay(null, fmt, 'Free')).toBe('Free');
    expect(formatShippingFeeDisplay(undefined, fmt, 'Free')).toBe('Free');
  });

  it('formats positive amounts', () => {
    expect(formatShippingFeeDisplay(5, fmt, 'Free')).toBe('€5.00');
  });
});
