import { isEmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';

/**
 * Stable selector for the customer-facing message. The English `error` text stays in the
 * response as a diagnostic for logs and non-UI consumers; the storefront renders the
 * translation behind this code instead.
 */
export const RETURN_ERROR_CODE = {
  RETURNS_FETCH_FAILED: 'RETURNS_FETCH_FAILED',
  RETURN_FETCH_FAILED: 'RETURN_FETCH_FAILED',
  RETURN_NOT_FOUND: 'RETURN_NOT_FOUND',
  ORDER_ID_REQUIRED: 'ORDER_ID_REQUIRED',
  ITEMS_REQUIRED: 'ITEMS_REQUIRED',
  REASON_CODE_REQUIRED: 'REASON_CODE_REQUIRED',
  REASON_CODE_INVALID: 'REASON_CODE_INVALID',
  REASON_DETAILS_INVALID: 'REASON_DETAILS_INVALID',
  ITEM_ID_INVALID: 'ITEM_ID_INVALID',
  ITEM_QUANTITY_INVALID: 'ITEM_QUANTITY_INVALID',
  ITEM_REASON_CODE_TYPE_INVALID: 'ITEM_REASON_CODE_TYPE_INVALID',
  ITEM_REASON_CODE_INVALID: 'ITEM_REASON_CODE_INVALID',
  ITEM_REASON_DETAILS_INVALID: 'ITEM_REASON_DETAILS_INVALID',
  ITEM_NOT_IN_ORDER: 'ITEM_NOT_IN_ORDER',
  ITEM_EXCEEDS_RETURNABLE_QUANTITY: 'ITEM_EXCEEDS_RETURNABLE_QUANTITY',
  VALIDATION_UNAVAILABLE: 'VALIDATION_UNAVAILABLE',
  UPSTREAM_REJECTED: 'UPSTREAM_REJECTED',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  UPSTREAM_FAILURE: 'UPSTREAM_FAILURE',
} as const;

export type ReturnErrorCode = (typeof RETURN_ERROR_CODE)[keyof typeof RETURN_ERROR_CODE];

/** Values a translated message may interpolate. Sent alongside the code, never pre-rendered. */
export interface ReturnErrorParams {
  itemId?: string;
  orderId?: string;
  requested?: number;
  remaining?: number;
  upstreamStatus?: number;
}

export const RETURN_API_REASON = {
  VALIDATION_UNAVAILABLE: 'validation_unavailable',
  UPSTREAM_REJECTED: 'upstream_rejected',
  UPSTREAM_UNAVAILABLE: 'upstream_unavailable',
  UPSTREAM_FAILURE: 'upstream_failure',
} as const;

export type ReturnApiReason = (typeof RETURN_API_REASON)[keyof typeof RETURN_API_REASON];

export interface ReturnApiErrorMapping {
  status: number;
  response: {
    error: string;
    code: ReturnErrorCode;
    params?: ReturnErrorParams;
    reason: ReturnApiReason;
    upstreamStatus?: number;
    upstreamMessage?: string;
  };
  logContext: Record<string, unknown>;
}

const UPSTREAM_BODY_MESSAGE_KEYS = ['message', 'error', 'status'] as const;

function tryParseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function getUpstreamMessage(body: string | undefined): string | undefined {
  if (!body) {
    return undefined;
  }

  const parsed = tryParseJsonObject(body);
  if (!parsed) {
    return body;
  }

  for (const key of UPSTREAM_BODY_MESSAGE_KEYS) {
    const value = parsed[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return body;
}

function getStatusForUpstreamFailure(upstreamStatus: number): number {
  if (upstreamStatus >= 500) {
    return upstreamStatus === 504 ? 504 : 502;
  }

  return upstreamStatus;
}

export function mapReturnCreateError(error: unknown): ReturnApiErrorMapping {
  if (isEmporixApiError(error)) {
    const upstreamMessage = getUpstreamMessage(error.body);
    const isUpstreamServerError = error.status >= 500;

    return {
      status: getStatusForUpstreamFailure(error.status),
      response: {
        error: isUpstreamServerError ? 'Returns service failed upstream' : 'Returns service rejected the request',
        code: isUpstreamServerError ? RETURN_ERROR_CODE.UPSTREAM_FAILURE : RETURN_ERROR_CODE.UPSTREAM_REJECTED,
        params: { upstreamStatus: error.status },
        reason: isUpstreamServerError ? RETURN_API_REASON.UPSTREAM_FAILURE : RETURN_API_REASON.UPSTREAM_REJECTED,
        upstreamStatus: error.status,
        upstreamMessage,
      },
      logContext: {
        reason: isUpstreamServerError ? RETURN_API_REASON.UPSTREAM_FAILURE : RETURN_API_REASON.UPSTREAM_REJECTED,
        upstreamOperation: error.operation,
        upstreamStatus: error.status,
        upstreamStatusText: error.statusText,
        upstreamBody: error.body,
      },
    };
  }

  return {
    status: 500,
    response: {
      error: 'Failed to create return',
      code: RETURN_ERROR_CODE.UPSTREAM_UNAVAILABLE,
      reason: RETURN_API_REASON.UPSTREAM_UNAVAILABLE,
    },
    logContext: { reason: RETURN_API_REASON.UPSTREAM_UNAVAILABLE },
  };
}

export function mapReturnValidationError(error: unknown): ReturnApiErrorMapping {
  if (isEmporixApiError(error)) {
    const upstreamMessage = getUpstreamMessage(error.body);

    return {
      status: 503,
      response: {
        error: 'Failed to validate return request',
        code: RETURN_ERROR_CODE.VALIDATION_UNAVAILABLE,
        params: { upstreamStatus: error.status },
        reason: RETURN_API_REASON.VALIDATION_UNAVAILABLE,
        upstreamStatus: error.status,
        upstreamMessage,
      },
      logContext: {
        reason: RETURN_API_REASON.VALIDATION_UNAVAILABLE,
        upstreamOperation: error.operation,
        upstreamStatus: error.status,
        upstreamStatusText: error.statusText,
        upstreamBody: error.body,
      },
    };
  }

  return {
    status: 503,
    response: {
      error: 'Failed to validate return request',
      code: RETURN_ERROR_CODE.VALIDATION_UNAVAILABLE,
      reason: RETURN_API_REASON.VALIDATION_UNAVAILABLE,
    },
    logContext: { reason: RETURN_API_REASON.VALIDATION_UNAVAILABLE },
  };
}
