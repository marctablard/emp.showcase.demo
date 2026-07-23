import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixOrderApi from './impl/EmporixOrderApi';

type AuthenticatedFetch = (
  ...args: Parameters<EmporixApiInvoker['authenticatedFetch']>
) => ReturnType<EmporixApiInvoker['authenticatedFetch']>;

type MockOrderApiClient = {
  authenticatedFetch: jest.MockedFunction<AuthenticatedFetch>;
};

const mockConfigLocal: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'mock-tenant',
  clientId: '',
  clientSecret: '',
  serverClientId: '',
  serverClientSecret: '',
};

describe('EmporixOrderApi customer transition (mocked)', () => {
  it('POSTs DECLINED with session token and metrics', async () => {
    const mockApiClient: MockOrderApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: jest.fn().mockResolvedValue(''),
      }),
    };

    const api = new EmporixOrderApi(mockApiClient, mockConfigLocal);
    await api.postCustomerOrderTransition('ord-1', { status: 'DECLINED' });

    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [path, options, tokenType, , metrics] = mockApiClient.authenticatedFetch.mock.calls[0];
    expect(path).toBe('/order-v2/mock-tenant/orders/ord-1/transitions');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ status: 'DECLINED' }),
      }),
    );
    expect(tokenType).toBe('session');
    expect(metrics).toEqual(expect.objectContaining({}));
  });

  it('normalizes customer GET transitions from transitions wrapper', async () => {
    const mockApiClient: MockOrderApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ transitions: [{ status: 'DECLINED' }] }),
      }),
    };

    const api = new EmporixOrderApi(mockApiClient, mockConfigLocal);
    const result = await api.getCustomerOrderStatusTransitions('ord-2');
    expect(result).toEqual(['DECLINED']);
  });

  it('builds customer orders request using pageNumber/pageSize/sort/q and parses total count', async () => {
    const mockApiClient: MockOrderApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn((name: string) => (name.toLowerCase() === 'x-total-count' ? '17' : null)),
        },
        json: jest.fn().mockResolvedValue([{ id: 'ord-1' }]),
      }),
    };

    const api = new EmporixOrderApi(mockApiClient, mockConfigLocal);
    const response = await api.getCustomerOrdersPage(10, 1, 'created:desc,id:asc', 'status:CREATED id:(ord-1,ord-2)');

    const [path, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
    const [endpoint, rawQuery = ''] = String(path).split('?');
    const queryParams = new URLSearchParams(rawQuery);

    expect(endpoint).toBe('/order-v2/mock-tenant/orders');
    expect(queryParams.get('pageSize')).toBe('10');
    expect(queryParams.get('pageNumber')).toBe('1');
    expect(queryParams.get('sort')).toBe('created:desc,id:asc');
    expect(queryParams.get('q')).toBe('status:CREATED id:(ord-1,ord-2)');
    expect(options).toEqual({ method: 'GET', headers: { 'X-Total-Count': 'true' } });
    expect(tokenType).toBe('session');
    expect(response).toEqual({ items: [{ id: 'ord-1' }], totalCount: 17 });
  });
});
