import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  CART_DISCOUNT_REASON,
  CART_SITE_MISMATCH_MESSAGE,
  CartCurrencyUpdateError,
  type CartDiscountReason,
  isCartDiscountError,
} from '@/platform/services/cart/errors';

export const CART_API_REASON = {
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  CONTEXT_MISMATCH: 'context_mismatch',
  UNSUPPORTED_CURRENCY: 'unsupported_currency',
  /** Generic coupon rejection whose cause could not be classified. */
  DISCOUNT_NOT_APPLICABLE: 'discount_not_applicable',
  /** Code exists and the customer may use it, but the cart fails its restrictions (threshold, currency, …). */
  COUPON_NOT_APPLICABLE: 'coupon_not_applicable',
  /** No coupon with this code exists (Coupon Service `resource_not_found`). */
  COUPON_NOT_FOUND: 'coupon_not_found',
  /** Code exists but is expired / not redeemable right now. */
  COUPON_NOT_ACTIVE: 'coupon_not_active',
  /** Code is already applied to this cart. */
  COUPON_ALREADY_APPLIED: 'coupon_already_applied',
  /** Code exists but this customer/segment may not redeem it. */
  COUPON_NOT_ELIGIBLE: 'coupon_not_eligible',
  UNAUTHORIZED: 'unauthorized',
  UPSTREAM_FAILURE: 'upstream_failure',
} as const;

export type CartApiErrorMapping = {
  status: number;
  response: Record<string, string>;
  logContext: Record<string, unknown>;
};

export function mapCartGetError(error: unknown): CartApiErrorMapping {
  if (error instanceof CartCurrencyUpdateError) {
    if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND) {
      return {
        status: 404,
        response: { error: 'Cart not found', reason: CART_API_REASON.NOT_FOUND },
        logContext: {
          reason: CART_API_REASON.NOT_FOUND,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }
    if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN) {
      return {
        status: 403,
        response: { error: 'Cart context is forbidden', reason: CART_API_REASON.FORBIDDEN },
        logContext: {
          reason: CART_API_REASON.FORBIDDEN,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }
    if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.CONTEXT_MISMATCH) {
      return {
        status: 409,
        response: { error: 'Cart context mismatch', reason: CART_API_REASON.CONTEXT_MISMATCH },
        logContext: {
          reason: CART_API_REASON.CONTEXT_MISMATCH,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }
  }

  return {
    status: 500,
    response: { error: 'Failed to process cart request', reason: CART_API_REASON.UPSTREAM_FAILURE },
    logContext: { reason: CART_API_REASON.UPSTREAM_FAILURE },
  };
}

export function mapCartCurrencyPutError(error: unknown): CartApiErrorMapping {
  if (error instanceof CartCurrencyUpdateError) {
    if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND) {
      return {
        status: 404,
        response: { error: 'Cart not found', reason: CART_API_REASON.NOT_FOUND },
        logContext: {
          reason: CART_API_REASON.NOT_FOUND,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }

    if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.UNSUPPORTED_CURRENCY) {
      return {
        status: 400,
        response: { error: 'Currency not supported', reason: CART_API_REASON.UNSUPPORTED_CURRENCY },
        logContext: { reason: CART_API_REASON.UNSUPPORTED_CURRENCY },
      };
    }

    if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN) {
      return {
        status: 403,
        response: { error: 'Cart context is forbidden', reason: CART_API_REASON.FORBIDDEN },
        logContext: {
          reason: CART_API_REASON.FORBIDDEN,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }

    if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.CONTEXT_MISMATCH) {
      return {
        status: 409,
        response: { error: 'Cart context mismatch', reason: CART_API_REASON.CONTEXT_MISMATCH },
        logContext: {
          reason: CART_API_REASON.CONTEXT_MISMATCH,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }
  }

  return {
    status: 500,
    response: { error: 'Failed to update cart currency', reason: CART_API_REASON.UPSTREAM_FAILURE },
    logContext: { reason: CART_API_REASON.UPSTREAM_FAILURE },
  };
}

type DiscountRejectionResponse = { error: string; reason: string };

/** 400 bodies per classified coupon rejection; the shopper copy is chosen client-side from `reason`. */
const DISCOUNT_REJECTION_RESPONSES: Record<CartDiscountReason, DiscountRejectionResponse> = {
  [CART_DISCOUNT_REASON.CODE_NOT_FOUND]: { error: 'Coupon code not found', reason: CART_API_REASON.COUPON_NOT_FOUND },
  [CART_DISCOUNT_REASON.NOT_ACTIVE]: { error: 'Coupon is not active', reason: CART_API_REASON.COUPON_NOT_ACTIVE },
  [CART_DISCOUNT_REASON.ALREADY_APPLIED]: {
    error: 'Coupon is already applied',
    reason: CART_API_REASON.COUPON_ALREADY_APPLIED,
  },
  [CART_DISCOUNT_REASON.NOT_ELIGIBLE]: {
    error: 'Coupon is not available for this customer',
    reason: CART_API_REASON.COUPON_NOT_ELIGIBLE,
  },
  [CART_DISCOUNT_REASON.NOT_APPLICABLE]: {
    error: 'Coupon does not apply to this cart',
    reason: CART_API_REASON.COUPON_NOT_APPLICABLE,
  },
};

/** Unclassified rejection (validation lookup failed or inconclusive): legacy generic reason. */
const DEFAULT_DISCOUNT_REJECTION: DiscountRejectionResponse = {
  error: 'Discount is not applicable',
  reason: CART_API_REASON.DISCOUNT_NOT_APPLICABLE,
};

function mapCartDiscountMutationError(error: unknown, upstreamFailureMessage: string): CartApiErrorMapping {
  if (isCartDiscountError(error)) {
    if (error.upstreamStatus === 401) {
      return {
        status: 401,
        response: { error: 'Authentication required', reason: CART_API_REASON.UNAUTHORIZED },
        logContext: {
          reason: CART_API_REASON.UNAUTHORIZED,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }

    if (error.upstreamStatus === 403 || error.message === CART_SITE_MISMATCH_MESSAGE) {
      return {
        status: 403,
        response: { error: 'Cart context is forbidden', reason: CART_API_REASON.FORBIDDEN },
        logContext: {
          reason: CART_API_REASON.FORBIDDEN,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }

    if (error.upstreamStatus === 404 || error.message === 'Cart not found') {
      return {
        status: 404,
        response: { error: 'Cart not found', reason: CART_API_REASON.NOT_FOUND },
        logContext: {
          reason: CART_API_REASON.NOT_FOUND,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }

    if (error.upstreamStatus != null && error.upstreamStatus >= 500) {
      return {
        status: 500,
        response: { error: upstreamFailureMessage, reason: CART_API_REASON.UPSTREAM_FAILURE },
        logContext: {
          reason: CART_API_REASON.UPSTREAM_FAILURE,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
        },
      };
    }

    const rejection = error.reason ? DISCOUNT_REJECTION_RESPONSES[error.reason] : DEFAULT_DISCOUNT_REJECTION;
    return {
      status: 400,
      response: rejection,
      logContext: {
        reason: rejection.reason,
        upstreamStatus: error.upstreamStatus,
        upstreamBody: error.upstreamBody,
      },
    };
  }

  return {
    status: 500,
    response: { error: upstreamFailureMessage, reason: CART_API_REASON.UPSTREAM_FAILURE },
    logContext: { reason: CART_API_REASON.UPSTREAM_FAILURE },
  };
}

export function mapCartDiscountApplyError(error: unknown): CartApiErrorMapping {
  return mapCartDiscountMutationError(error, 'Failed to apply discount');
}

export function mapCartDiscountRemoveError(error: unknown): CartApiErrorMapping {
  return mapCartDiscountMutationError(error, 'Failed to remove discount');
}
