import { EmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import { RETURN_API_REASON, mapReturnCreateError, mapReturnValidationError } from './return-api-error-mapping';

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
    expect(mapping.response.reason).toBe(RETURN_API_REASON.VALIDATION_UNAVAILABLE);
    expect(mapping.response.upstreamStatus).toBe(503);
  });
});
