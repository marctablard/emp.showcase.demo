import { CartErrorCode } from '@/platform/services/model/cart/error-codes';
import { cartAddItemErrorResponse } from './cart-add-item-error';

describe('cartAddItemErrorResponse', () => {
  it('maps invalid PriceIds to PRICE_SITE_INCOMPATIBLE and keeps the upstream message', async () => {
    const response = cartAddItemErrorResponse('PriceIds [abc] are invalid for this site');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: CartErrorCode.PRICE_SITE_INCOMPATIBLE,
        error: 'PriceIds [abc] are invalid for this site',
      }),
    );
  });

  it('maps siteCode mismatch to CART_SITE_MISMATCH', async () => {
    const response = cartAddItemErrorResponse('siteCode does not match the current session');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: CartErrorCode.CART_SITE_MISMATCH,
      }),
    );
  });

  it('returns 500 when there is no mapped code or upstream message', async () => {
    const response = cartAddItemErrorResponse('unexpected failure');
    expect(response.status).toBe(500);
  });
});
