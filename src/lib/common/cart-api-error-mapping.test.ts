import { CART_API_REASON, mapCartCurrencyPutError, mapCartGetError } from '@/lib/common/cart-api-error-mapping';
import { CART_CURRENCY_UPDATE_ERROR_CODE, CartCurrencyUpdateError } from '@/platform/services/cart/errors';

describe('cart-api-error-mapping', () => {
  describe('mapCartGetError', () => {
    it('maps cart not found error to 404 reason', () => {
      const mapping = mapCartGetError(
        new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND, 'Cart not found'),
      );

      expect(mapping.status).toBe(404);
      expect(mapping.response.reason).toBe(CART_API_REASON.NOT_FOUND);
    });

    it('maps forbidden error to 403 reason', () => {
      const mapping = mapCartGetError(
        new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context', {
          upstreamStatus: 403,
        }),
      );

      expect(mapping.status).toBe(403);
      expect(mapping.response.reason).toBe(CART_API_REASON.FORBIDDEN);
      expect(mapping.logContext.upstreamStatus).toBe(403);
    });
  });

  describe('mapCartCurrencyPutError', () => {
    it('maps unsupported currency to 400 reason', () => {
      const mapping = mapCartCurrencyPutError(
        new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.UNSUPPORTED_CURRENCY, 'Currency not supported'),
      );

      expect(mapping.status).toBe(400);
      expect(mapping.response.reason).toBe(CART_API_REASON.UNSUPPORTED_CURRENCY);
    });

    it('maps unknown errors to 500 upstream_failure', () => {
      const mapping = mapCartCurrencyPutError(new Error('boom'));

      expect(mapping.status).toBe(500);
      expect(mapping.response.reason).toBe(CART_API_REASON.UPSTREAM_FAILURE);
    });
  });
});
