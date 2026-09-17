import { currencySwitchBlockedCopy } from './currency-switch-message';

describe('currencySwitchBlockedCopy', () => {
  it('uses coupon copy when codes are present', () => {
    expect(currencySwitchBlockedCopy('CHF', 'EUR', [' ACCESSORIES15 ', 'ACCESSORIES15', ''])).toEqual({
      key: 'currencySwitchCouponBlocked',
      values: { fromCurrency: 'CHF', toCurrency: 'EUR', codes: 'ACCESSORIES15' },
    });
  });

  it('uses cart-item copy when no coupon codes are present', () => {
    expect(currencySwitchBlockedCopy('CHF', 'EUR')).toEqual({
      key: 'currencySwitchCartBlocked',
      values: { fromCurrency: 'CHF', toCurrency: 'EUR' },
    });
  });
});
