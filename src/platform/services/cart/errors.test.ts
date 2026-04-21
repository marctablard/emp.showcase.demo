import { CART_CURRENCY_UPDATE_ERROR_CODE, CartCurrencyUpdateError, isCartCurrencyUpdateError } from './errors';

describe('cart errors', () => {
  it('isCartCurrencyUpdateError recognizes instances', () => {
    const err = new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.UNSUPPORTED_CURRENCY, 'x');
    expect(isCartCurrencyUpdateError(err)).toBe(true);
  });

  it('isCartCurrencyUpdateError recognizes duck-typed errors', () => {
    const err = new Error('x');
    err.name = 'CartCurrencyUpdateError';
    expect(isCartCurrencyUpdateError(err)).toBe(true);
  });

  it('isCartCurrencyUpdateError rejects unrelated errors', () => {
    expect(isCartCurrencyUpdateError(new Error('other'))).toBe(false);
    expect(isCartCurrencyUpdateError(null)).toBe(false);
  });
});
