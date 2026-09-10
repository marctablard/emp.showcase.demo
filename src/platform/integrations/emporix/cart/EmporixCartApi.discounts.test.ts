import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixCartApi from './impl/EmporixCartApi';

type AuthenticatedFetch = (
  ...args: Parameters<EmporixApiInvoker['authenticatedFetch']>
) => ReturnType<EmporixApiInvoker['authenticatedFetch']>;

type MockCartApiClient = {
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

const jsonResponse = (init: { ok: boolean; status: number; statusText: string; body?: string }): Response =>
  ({
    ok: init.ok,
    status: init.status,
    statusText: init.statusText,
    json: jest.fn().mockResolvedValue(init.body ? JSON.parse(init.body) : {}),
    text: jest.fn().mockResolvedValue(init.body ?? ''),
  }) as unknown as Response;

describe('EmporixCartApi discounts (mocked)', () => {
  it('POSTs { code } to cart discounts with session token and no legalEntityId header', async () => {
    const mockApiClient: MockCartApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(
        jsonResponse({
          ok: true,
          status: 201,
          statusText: 'Created',
          body: JSON.stringify({ yrn: 'yrn:discount', discountId: '1', discountIndex: 0 }),
        }),
      ),
    };
    const api = new EmporixCartApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await expect(api.applyDiscount('cart-1', 'LS10PTOTAL')).resolves.toBeUndefined();

    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [url, options, tokenType, authOptions, metrics] = mockApiClient.authenticatedFetch.mock.calls[0];
    expect(url).toBe('/cart/test-tenant/carts/cart-1/discounts');
    expect(options).toEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code: 'LS10PTOTAL' }),
    });
    expect(JSON.parse(String(options?.body))).toEqual({ code: 'LS10PTOTAL' });
    expect(options?.headers).not.toHaveProperty('legalEntityId');
    expect(tokenType).toBe('session');
    expect(authOptions).toBeUndefined();
    expect(metrics).toEqual({
      source: 'cart',
      routePattern: '/cart/{tenant}/carts/{cartId}/discounts',
    });
  });

  it('DELETEs a discount by index with session token and no legalEntityId header', async () => {
    const mockApiClient: MockCartApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(
        jsonResponse({
          ok: true,
          status: 204,
          statusText: 'No Content',
        }),
      ),
    };
    const api = new EmporixCartApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await expect(api.removeDiscount('cart-1', 0)).resolves.toBeUndefined();

    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [url, options, tokenType, authOptions, metrics] = mockApiClient.authenticatedFetch.mock.calls[0];
    expect(url).toBe('/cart/test-tenant/carts/cart-1/discounts/0');
    expect(options).toEqual({ method: 'DELETE' });
    expect(options?.headers).toBeUndefined();
    expect(tokenType).toBe('session');
    expect(authOptions).toBeUndefined();
    expect(metrics).toEqual({
      source: 'cart',
      routePattern: '/cart/{tenant}/carts/{cartId}/discounts/{discountIndex}',
    });
  });

  it('throws an Error whose text includes HTTP status and the 400 body', async () => {
    const upstreamBody = '{"code":400,"status":"Bad Request","message":"Discount is not allowed"}';
    const mockApiClient: MockCartApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(
        jsonResponse({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          body: upstreamBody,
        }),
      ),
    };
    const api = new EmporixCartApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await expect(api.applyDiscount('cart-1', 'NOTALLOWED')).rejects.toThrow(
      `Failed to apply discount to cart: 400 Bad Request ${upstreamBody}`,
    );
  });
});
