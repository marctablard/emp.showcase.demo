import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixOrderApi from './impl/EmporixOrderApi';

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
    const mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: jest.fn().mockResolvedValue(''),
      }),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

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
    const mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ transitions: [{ status: 'DECLINED' }] }),
      }),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    const api = new EmporixOrderApi(mockApiClient, mockConfigLocal);
    const result = await api.getCustomerOrderStatusTransitions('ord-2');
    expect(result).toEqual(['DECLINED']);
  });
});
