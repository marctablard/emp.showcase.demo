import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  CartCurrencyUpdateError,
  CartDiscountError,
  isCartCurrencyUpdateError,
  isCartDiscountError,
  isCouponRelatedCurrencyFailure,
} from './errors';

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

  it('isCartDiscountError recognizes instances', () => {
    const err = new CartDiscountError('x', { upstreamStatus: 400, upstreamBody: '{"status":400}' });
    expect(isCartDiscountError(err)).toBe(true);
    expect(err.upstreamStatus).toBe(400);
    expect(err.upstreamBody).toBe('{"status":400}');
  });

  it('isCartDiscountError recognizes duck-typed errors', () => {
    const err = new Error('x');
    err.name = 'CartDiscountError';
    expect(isCartDiscountError(err)).toBe(true);
  });

  it('isCartDiscountError rejects unrelated errors', () => {
    expect(isCartDiscountError(new Error('other'))).toBe(false);
    expect(isCartDiscountError(new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'x'))).toBe(
      false,
    );
    expect(isCartDiscountError(null)).toBe(false);
  });

  it('detects coupon-related currency failures from the upstream body only', () => {
    expect(isCouponRelatedCurrencyFailure('Failed to update cart currency')).toBe(false);
    expect(
      isCouponRelatedCurrencyFailure(
        'Failed to change cart currency: Bad Request',
        '{"code":400,"message":"Price not found for item"}',
      ),
    ).toBe(false);
    expect(
      isCouponRelatedCurrencyFailure(
        'Failed to change cart currency: Bad Request',
        '{"code":400,"message":"Discount currency does not match"}',
      ),
    ).toBe(true);
    expect(isCouponRelatedCurrencyFailure('Coupon blocks currency update')).toBe(true);
  });
});
