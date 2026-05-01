import type { Site } from '@/platform/services/model/common/site';
import {
  isProductPriceDisplayableForPurchase,
  isProductPriceDisplayableForShopContext,
  isPurchaseShopContextReady,
  siteAllowsCurrency,
  stripProductPriceIfNotDisplayableForShopContext,
} from './product-price-site-context';

const siteWithEurChf = {
  code: 'brand1',
  currencies: [{ id: 'CHF' }, { id: 'EUR' }],
} as Site;

const sessionChfBrand1 = { currency: 'CHF', siteCode: 'brand1' };

describe('product-price-site-context', () => {
  test('siteAllowsCurrency respects site list', () => {
    expect(siteAllowsCurrency(siteWithEurChf, 'CHF')).toBe(true);
    expect(siteAllowsCurrency(siteWithEurChf, 'USD')).toBe(false);
    expect(siteAllowsCurrency(undefined, 'CHF')).toBe(true);
  });

  test('isProductPriceDisplayableForShopContext requires session match and site allow-list', () => {
    expect(isProductPriceDisplayableForShopContext('CHF', 'CHF', siteWithEurChf)).toBe(true);
    expect(isProductPriceDisplayableForShopContext('EUR', 'CHF', siteWithEurChf)).toBe(false);
    expect(isProductPriceDisplayableForShopContext('USD', 'USD', siteWithEurChf)).toBe(false);
  });

  test('isPurchaseShopContextReady requires URL site and session site to match', () => {
    expect(isPurchaseShopContextReady({ currency: 'CHF', siteCode: 'brand1' }, siteWithEurChf)).toBe(true);
    expect(isPurchaseShopContextReady({ currency: 'CHF', siteCode: 'other' }, siteWithEurChf)).toBe(false);
    expect(isPurchaseShopContextReady({ currency: 'CHF', siteCode: 'brand1' }, undefined)).toBe(false);
    expect(isPurchaseShopContextReady(undefined, siteWithEurChf)).toBe(false);
  });

  test('isProductPriceDisplayableForPurchase also requires aligned session/site', () => {
    expect(isProductPriceDisplayableForPurchase('CHF', sessionChfBrand1, siteWithEurChf)).toBe(true);
    expect(isProductPriceDisplayableForPurchase('CHF', { currency: 'CHF', siteCode: 'other' }, siteWithEurChf)).toBe(
      false,
    );
  });

  test('stripProductPriceIfNotDisplayableForShopContext removes invalid price', () => {
    const p = { id: 'x', price: { amount: 10, currency: 'USD' } };
    const out = stripProductPriceIfNotDisplayableForShopContext(p, sessionChfBrand1, siteWithEurChf);
    expect(out.price).toBeUndefined();
    const ok = stripProductPriceIfNotDisplayableForShopContext(
      { id: 'x', price: { amount: 10, currency: 'CHF' } },
      sessionChfBrand1,
      siteWithEurChf,
    );
    expect(ok.price?.currency).toBe('CHF');
  });

  test('stripProductPriceIfNotDisplayableForShopContext strips when session site disagrees with URL site', () => {
    const p = { id: 'x', price: { amount: 10, currency: 'CHF' } };
    const out = stripProductPriceIfNotDisplayableForShopContext(
      p,
      { currency: 'CHF', siteCode: 'other' },
      siteWithEurChf,
    );
    expect(out.price).toBeUndefined();
  });
});
