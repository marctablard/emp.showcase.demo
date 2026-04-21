import { getPublicDefaultLanguage } from '@/lib/common/public-default-env';
import { formatCurrency, formatCurrencyToParts } from './utils';

describe('currency formatting utilities', () => {
  it('formats currency using explicitly provided locale', () => {
    const amount = 1234.5;
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    expect(formatCurrency(amount, 'EUR', 'en-US')).toBe(expected);
  });

  it('uses default language from env when locale is omitted', () => {
    const amount = 1234.5;
    const expected = new Intl.NumberFormat(getPublicDefaultLanguage(), {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    expect(formatCurrency(amount, 'EUR')).toBe(expected);
  });

  it('formats currency parts using locale resolution', () => {
    const amount = 99.99;
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount);

    expect(formatCurrencyToParts(amount, 'USD', 'en-US')).toEqual(expected);
  });
});
