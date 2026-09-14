import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  CartCurrencyUpdateError,
  isCartDiscountError,
} from '@/platform/services/cart/errors';

export const CART_API_REASON = {
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  CONTEXT_MISMATCH: 'context_mismatch',
  UNSUPPORTED_CURRENCY: 'unsupported_currency',
  DISCOUNT_NOT_APPLICABLE: 'discount_not_applicable',
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

    if (error.upstreamStatus === 403) {
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

    return {
      status: 400,
      response: { error: 'Discount is not applicable', reason: CART_API_REASON.DISCOUNT_NOT_APPLICABLE },
      logContext: {
        reason: CART_API_REASON.DISCOUNT_NOT_APPLICABLE,
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
