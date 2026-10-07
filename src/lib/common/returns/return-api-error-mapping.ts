import { isEmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import { RETURN_ERROR_CODE, type ReturnErrorCode, type ReturnErrorParams } from './return-error-codes';

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

/**
 * Neither 401 nor 403 is an input problem, and they need different advice: an expired session is
 * fixed by signing in again, a missing permission is not. Both paths below use this, because the
 * returnability lookup runs first and would otherwise swallow the distinction.
 */
function getAuthErrorCode(upstreamStatus: number): ReturnErrorCode | undefined {
  if (upstreamStatus === 401) {
    return RETURN_ERROR_CODE.UPSTREAM_SESSION_EXPIRED;
  }

  return upstreamStatus === 403 ? RETURN_ERROR_CODE.UPSTREAM_FORBIDDEN : undefined;
}

function getCreateErrorCode(upstreamStatus: number): ReturnErrorCode {
  return (
    getAuthErrorCode(upstreamStatus) ??
    (upstreamStatus >= 500 ? RETURN_ERROR_CODE.UPSTREAM_FAILURE : RETURN_ERROR_CODE.UPSTREAM_REJECTED)
  );
}

export function mapReturnCreateError(error: unknown): ReturnApiErrorMapping {
  if (isEmporixApiError(error)) {
    const upstreamMessage = getUpstreamMessage(error.body);
    const isUpstreamServerError = error.status >= 500;

    return {
      status: getStatusForUpstreamFailure(error.status),
      response: {
        error: isUpstreamServerError ? 'Returns service failed upstream' : 'Returns service rejected the request',
        code: getCreateErrorCode(error.status),
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
        code: getAuthErrorCode(error.status) ?? RETURN_ERROR_CODE.VALIDATION_UNAVAILABLE,
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
