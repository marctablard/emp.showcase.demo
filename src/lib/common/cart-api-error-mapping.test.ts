import {
  CART_API_REASON,
  isCouponCurrencyConflictClientError,
  mapCartCurrencyPutError,
  mapCartDiscountApplyError,
  mapCartDiscountRemoveError,
  mapCartGetError,
} from '@/lib/common/cart-api-error-mapping';
import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  CART_DISCOUNT_REASON,
  CART_SITE_MISMATCH_MESSAGE,
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

    it('maps coupon-currency conflict to 409 coupon_currency_conflict', () => {
      const mapping = mapCartCurrencyPutError(
        new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT, 'Coupon blocks currency'),
      );

      expect(mapping.status).toBe(409);
      expect(mapping.response.reason).toBe(CART_API_REASON.COUPON_CURRENCY_CONFLICT);
      expect(mapping.response.error).toBe('Coupon blocks currency update');
    });

    it('maps unknown errors to 500 upstream_failure', () => {
      const mapping = mapCartCurrencyPutError(new Error('boom'));

      expect(mapping.status).toBe(500);
      expect(mapping.response.reason).toBe(CART_API_REASON.UPSTREAM_FAILURE);
    });

    it('detects a classified coupon-currency conflict on a client error', () => {
      const byReason = Object.assign(new Error('Coupon blocks currency'), {
        reason: CART_API_REASON.COUPON_CURRENCY_CONFLICT,
      });
      const byCode = Object.assign(new Error('Coupon blocks currency'), {
        code: CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT,
      });
      expect(isCouponCurrencyConflictClientError(byReason)).toBe(true);
      expect(isCouponCurrencyConflictClientError(byCode)).toBe(true);
      expect(isCouponCurrencyConflictClientError(new Error('Failed to update cart currency'))).toBe(false);
      expect(isCouponCurrencyConflictClientError({ reason: CART_API_REASON.CONTEXT_MISMATCH })).toBe(false);
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

    it.each([
      [CART_DISCOUNT_REASON.CODE_NOT_FOUND, CART_API_REASON.COUPON_NOT_FOUND],
      [CART_DISCOUNT_REASON.NOT_ACTIVE, CART_API_REASON.COUPON_NOT_ACTIVE],
      [CART_DISCOUNT_REASON.ALREADY_APPLIED, CART_API_REASON.COUPON_ALREADY_APPLIED],
      [CART_DISCOUNT_REASON.NOT_ELIGIBLE, CART_API_REASON.COUPON_NOT_ELIGIBLE],
      [CART_DISCOUNT_REASON.NOT_APPLICABLE, CART_API_REASON.COUPON_NOT_APPLICABLE],
    ])('maps classified coupon rejection %s to 400 %s', (reason, apiReason) => {
      const mapping = mapCartDiscountApplyError(
        new CartDiscountError('Failed to apply discount', { upstreamStatus: 400, reason }),
      );

      expect(mapping.status).toBe(400);
      expect(mapping.response.reason).toBe(apiReason);
      expect(mapping.logContext.reason).toBe(apiReason);
    });

    it('maps an already-applied rejection (upstream 409) to 400 coupon_already_applied', () => {
      const mapping = mapCartDiscountApplyError(
        new CartDiscountError('Failed to apply discount', {
          upstreamStatus: 409,
          reason: CART_DISCOUNT_REASON.ALREADY_APPLIED,
        }),
      );

      expect(mapping.status).toBe(400);
      expect(mapping.response.reason).toBe(CART_API_REASON.COUPON_ALREADY_APPLIED);
      expect(mapping.logContext.upstreamStatus).toBe(409);
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

      const wrongSite = mapCartDiscountApplyError(new CartDiscountError(CART_SITE_MISMATCH_MESSAGE));
      expect(wrongSite.status).toBe(403);
      expect(wrongSite.response.reason).toBe(CART_API_REASON.FORBIDDEN);
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

    it('maps a classified coupon rejection whose upstream status is 500 to 400 coupon_not_applicable', () => {
      const mapping = mapCartDiscountApplyError(
        new CartDiscountError('Failed to apply discount', {
          upstreamStatus: 500,
          reason: CART_DISCOUNT_REASON.NOT_APPLICABLE,
        }),
      );

      expect(mapping.status).toBe(400);
      expect(mapping.response.reason).toBe(CART_API_REASON.COUPON_NOT_APPLICABLE);
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
