import { EmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import { RETURN_API_REASON, mapReturnCreateError, mapReturnValidationError } from './return-api-error-mapping';
import { RETURN_ERROR_CODE } from './return-error-codes';

describe('return-api-error-mapping', () => {
  it('maps upstream 5xx create failures to backend failure responses', () => {
    const mapping = mapReturnCreateError(
      new EmporixApiError({
        operation: 'Create return',
        status: 502,
        statusText: 'Bad Gateway',
        body: 'Bad Gateway',
      }),
    );

    expect(mapping.status).toBe(502);
    expect(mapping.response.code).toBe(RETURN_ERROR_CODE.UPSTREAM_FAILURE);
    expect(mapping.response.reason).toBe(RETURN_API_REASON.UPSTREAM_FAILURE);
    expect(mapping.response.upstreamStatus).toBe(502);
    expect(mapping.response.upstreamMessage).toBe('Bad Gateway');
  });

  it('maps upstream 4xx create failures as rejected requests', () => {
    const mapping = mapReturnCreateError(
      new EmporixApiError({
        operation: 'Create return',
        status: 409,
        statusText: 'Conflict',
        body: '{"message":"Return already exists"}',
      }),
    );

    expect(mapping.status).toBe(409);
    expect(mapping.response.code).toBe(RETURN_ERROR_CODE.UPSTREAM_REJECTED);
    expect(mapping.response.reason).toBe(RETURN_API_REASON.UPSTREAM_REJECTED);
    expect(mapping.response.upstreamMessage).toBe('Return already exists');
  });

  it('keeps validation dependency failures as service unavailable with upstream context', () => {
    const mapping = mapReturnValidationError(
      new EmporixApiError({
        operation: 'Get returns',
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );

    expect(mapping.status).toBe(503);
    expect(mapping.response.code).toBe(RETURN_ERROR_CODE.VALIDATION_UNAVAILABLE);
    expect(mapping.response.reason).toBe(RETURN_API_REASON.VALIDATION_UNAVAILABLE);
    expect(mapping.response.upstreamStatus).toBe(503);
  });

  it.each([
    [401, RETURN_ERROR_CODE.UPSTREAM_SESSION_EXPIRED],
    [403, RETURN_ERROR_CODE.UPSTREAM_FORBIDDEN],
  ])('maps a create failure with upstream %s to its own code instead of blaming the input', (status, expected) => {
    const mapping = mapReturnCreateError(
      new EmporixApiError({ operation: 'Create return', status, statusText: 'Denied' }),
    );

    expect(mapping.response.code).toBe(expected);
  });

  it.each([
    [401, RETURN_ERROR_CODE.UPSTREAM_SESSION_EXPIRED],
    [403, RETURN_ERROR_CODE.UPSTREAM_FORBIDDEN],
  ])('maps a validation failure with upstream %s the same way, since that lookup runs first', (status, expected) => {
    const mapping = mapReturnValidationError(
      new EmporixApiError({ operation: 'Get returns', status, statusText: 'Denied' }),
    );

    expect(mapping.response.code).toBe(expected);
    expect(mapping.response.code).not.toBe(RETURN_ERROR_CODE.VALIDATION_UNAVAILABLE);
  });
});
