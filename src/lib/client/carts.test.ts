import { CART_API_REASON } from '@/lib/common/cart-api-error-mapping';
import { CART_CURRENCY_UPDATE_ERROR_CODE } from '@/platform/services/cart/errors';
import { updateCartCurrency } from './carts';

describe('updateCartCurrency', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('preserves code so site-switch can recognize a coupon-currency conflict', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        error: 'Cart currency update failed',
        code: CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT,
        reason: CART_API_REASON.COUPON_CURRENCY_CONFLICT,
      }),
    }) as unknown as typeof fetch;

    await expect(updateCartCurrency('cart-1', 'USD')).rejects.toEqual(
      expect.objectContaining({
        code: CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT,
        reason: CART_API_REASON.COUPON_CURRENCY_CONFLICT,
        status: 409,
      }),
    );
  });
});
