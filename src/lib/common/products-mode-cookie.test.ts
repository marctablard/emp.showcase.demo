import { PRODUCTS_MODE_COOKIE_NAME, formatProductsModeOptIn, isProductsModeOptIn } from './products-mode-cookie';

describe('products-mode-cookie', () => {
  it('uses the next-products-mode cookie name', () => {
    expect(PRODUCTS_MODE_COOKIE_NAME).toBe('next-products-mode');
  });

  it('formats the opt-in value bound to the customer id', () => {
    expect(formatProductsModeOptIn('c1')).toBe('all.c1');
  });

  describe('isProductsModeOptIn', () => {
    it('accepts the value bound to the same customer id', () => {
      expect(isProductsModeOptIn('all.c1', 'c1')).toBe(true);
    });

    it('rejects a value bound to another customer id', () => {
      expect(isProductsModeOptIn('all.c2', 'c1')).toBe(false);
    });

    it('rejects a missing value', () => {
      expect(isProductsModeOptIn(undefined, 'c1')).toBe(false);
    });

    it('rejects a bare "all" without a customer binding', () => {
      expect(isProductsModeOptIn('all', 'c1')).toBe(false);
    });
  });
});
