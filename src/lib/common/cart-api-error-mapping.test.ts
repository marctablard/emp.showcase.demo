import {
  CART_API_REASON,
  mapCartCurrencyPutError,
  mapCartDiscountApplyError,
  mapCartDiscountRemoveError,
  mapCartGetError,
} from '@/lib/common/cart-api-error-mapping';
import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  CartCurrencyUpdateError,
  CartDiscountError,
} from '@/platform/services/cart/errors';

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

  describe('mapCartDiscountApplyError', () => {
    it('maps typed discount reject to 400 discount_not_applicable', () => {
      const mapping = mapCartDiscountApplyError(
        new CartDiscountError('Failed to apply discount', {
          upstreamStatus: 400,
          upstreamBody: '{"status":400}',
        }),
      );

      expect(mapping.status).toBe(400);
      expect(mapping.response.reason).toBe(CART_API_REASON.DISCOUNT_NOT_APPLICABLE);
      expect(mapping.response.error).toBe('Discount is not applicable');
      expect(mapping.logContext.upstreamStatus).toBe(400);
    });

    it('maps typed 401/403/404 discount errors to matching statuses', () => {
      const unauthorized = mapCartDiscountApplyError(
        new CartDiscountError('Failed to apply discount', { upstreamStatus: 401 }),
      );
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.response.reason).toBe(CART_API_REASON.UNAUTHORIZED);

      const forbidden = mapCartDiscountApplyError(
        new CartDiscountError('Failed to apply discount', { upstreamStatus: 403 }),
      );
      expect(forbidden.status).toBe(403);
      expect(forbidden.response.reason).toBe(CART_API_REASON.FORBIDDEN);

      const notFound = mapCartDiscountApplyError(new CartDiscountError('Cart not found'));
      expect(notFound.status).toBe(404);
      expect(notFound.response.reason).toBe(CART_API_REASON.NOT_FOUND);
    });

    it('maps unknown errors to 500 upstream_failure', () => {
      const mapping = mapCartDiscountApplyError(new Error('boom'));

      expect(mapping.status).toBe(500);
      expect(mapping.response.reason).toBe(CART_API_REASON.UPSTREAM_FAILURE);
    });

    it('maps typed 500 CartDiscountError to 500 upstream_failure', () => {
      const mapping = mapCartDiscountApplyError(
        new CartDiscountError('Failed to apply discount', { upstreamStatus: 500 }),
      );

      expect(mapping.status).toBe(500);
      expect(mapping.response.reason).toBe(CART_API_REASON.UPSTREAM_FAILURE);
      expect(mapping.logContext.upstreamStatus).toBe(500);
    });
  });

  describe('mapCartDiscountRemoveError', () => {
    it('maps typed discount reject to 400 discount_not_applicable', () => {
      const mapping = mapCartDiscountRemoveError(
        new CartDiscountError('Failed to remove discount', { upstreamStatus: 409 }),
      );

      expect(mapping.status).toBe(400);
      expect(mapping.response.reason).toBe(CART_API_REASON.DISCOUNT_NOT_APPLICABLE);
    });

    it('maps unknown errors to 500 upstream_failure', () => {
      const mapping = mapCartDiscountRemoveError(new Error('boom'));

      expect(mapping.status).toBe(500);
      expect(mapping.response.reason).toBe(CART_API_REASON.UPSTREAM_FAILURE);
    });
  });
});
