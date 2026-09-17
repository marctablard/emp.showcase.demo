import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixCouponApi from './impl/EmporixCouponApi';

type AuthenticatedFetch = (
  ...args: Parameters<EmporixApiInvoker['authenticatedFetch']>
) => ReturnType<EmporixApiInvoker['authenticatedFetch']>;

type MockApiClient = {
  authenticatedFetch: jest.MockedFunction<AuthenticatedFetch>;
};

const mockConfig: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'test-tenant',
  clientId: '',
  clientSecret: '',
  serverClientId: '',
  serverClientSecret: '',
};

const parseJson = (body: string | undefined): Promise<unknown> => {
  try {
    return Promise.resolve(body ? JSON.parse(body) : {});
  } catch (error) {
    return Promise.reject(error);
  }
};

const response = (init: { status: number; statusText?: string; body?: string }): Response =>
  ({
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    statusText: init.statusText ?? '',
    json: jest.fn().mockImplementation(() => parseJson(init.body)),
    text: jest.fn().mockResolvedValue(init.body ?? ''),
  }) as unknown as Response;

function createApi(fetchResponse: Response) {
  const apiClient: MockApiClient = { authenticatedFetch: jest.fn().mockResolvedValue(fetchResponse) };
  return { api: new EmporixCouponApi(apiClient as unknown as EmporixApiInvoker, mockConfig), apiClient };
}

describe('EmporixCouponApi.validateCoupon (mocked)', () => {
  it('POSTs orderTotal + zero discount with the service token to the encoded validation URL', async () => {
    const { api, apiClient } = createApi(response({ status: 200 }));

    await expect(api.validateCoupon('SUMMER 10%', { orderTotal: { amount: 90, currency: 'EUR' } })).resolves.toEqual({
      ok: true,
    });

    const [url, options, tokenType, authOptions, metrics] = apiClient.authenticatedFetch.mock.calls[0];
    expect(url).toBe('/coupon/test-tenant/coupons/SUMMER%2010%25/validation');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(String(options?.body))).toEqual({
      orderTotal: { amount: 90, currency: 'EUR' },
      discount: { amount: 0, currency: 'EUR' },
    });
    expect(tokenType).toBe('service');
    expect(authOptions).toEqual({ scopes: ['coupon.coupon_redeem', 'coupon.coupon_redeem_on_behalf'] });
    expect(metrics).toEqual({ source: 'coupon', routePattern: '/coupon/{tenant}/coupons/{code}/validation' });
  });

  it('includes legalEntityId in the body when provided', async () => {
    const { api, apiClient } = createApi(response({ status: 200 }));

    await api.validateCoupon('CODE', { orderTotal: { amount: 10, currency: 'CHF' }, legalEntityId: 'le-1' });

    expect(JSON.parse(String(apiClient.authenticatedFetch.mock.calls[0][1]?.body))).toEqual({
      orderTotal: { amount: 10, currency: 'CHF' },
      discount: { amount: 0, currency: 'CHF' },
      legalEntityId: 'le-1',
    });
  });

  it('includes customerNumber when validating on behalf of a shopper', async () => {
    const { api, apiClient } = createApi(response({ status: 200 }));

    await api.validateCoupon('CODE', {
      orderTotal: { amount: 10, currency: 'EUR' },
      customerNumber: 'cust-1',
    });

    expect(JSON.parse(String(apiClient.authenticatedFetch.mock.calls[0][1]?.body))).toEqual({
      orderTotal: { amount: 10, currency: 'EUR' },
      discount: { amount: 0, currency: 'EUR' },
      customerNumber: 'cust-1',
    });
  });

  it('returns type and details[].type for a business rejection', async () => {
    const { api } = createApi(
      response({
        status: 400,
        body: JSON.stringify({
          type: 'business_error',
          status: 400,
          message: 'Coupon cannot be redeemed',
          details: [
            { type: 'coupon_segment_customer_not_assigned', message: 'not a member' },
            { message: 'no type' },
            'not-an-object',
          ],
        }),
      }),
    );

    await expect(api.validateCoupon('VKTEST-PROMO03', { orderTotal: { amount: 1, currency: 'CHF' } })).resolves.toEqual(
      {
        ok: false,
        status: 400,
        type: 'business_error',
        detailTypes: ['coupon_segment_customer_not_assigned'],
      },
    );
  });

  it('returns resource_not_found for an unknown code', async () => {
    const { api } = createApi(
      response({ status: 404, body: JSON.stringify({ type: 'resource_not_found', status: 404, message: 'x' }) }),
    );

    await expect(api.validateCoupon('NOPE', { orderTotal: { amount: 1, currency: 'EUR' } })).resolves.toEqual({
      ok: false,
      status: 404,
      type: 'resource_not_found',
      detailTypes: [],
    });
  });

  it('returns an untyped outcome for a 4xx without a JSON body', async () => {
    const { api } = createApi(response({ status: 401, body: '<html>unauthorized</html>' }));

    await expect(api.validateCoupon('CODE', { orderTotal: { amount: 1, currency: 'EUR' } })).resolves.toEqual({
      ok: false,
      status: 401,
      detailTypes: [],
    });
  });

  it('throws on a 5xx', async () => {
    const { api } = createApi(response({ status: 503, statusText: 'Service Unavailable', body: 'down' }));

    await expect(api.validateCoupon('CODE', { orderTotal: { amount: 1, currency: 'EUR' } })).rejects.toThrow(
      'Failed to validate coupon: 503 Service Unavailable down',
    );
  });
});
