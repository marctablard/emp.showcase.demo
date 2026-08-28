import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixProductApi from './impl/EmporixProductApi';

const mockConfig: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'test-tenant',
  clientId: '',
  clientSecret: '',
  serverClientId: '',
  serverClientSecret: '',
};

describe('EmporixProductApi.searchProducts (mocked)', () => {
  it('throws a readable error when product search returns a non-JSON 503', async () => {
    const authenticatedFetch = jest.fn().mockResolvedValue(
      new Response('no available server\n', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }),
    );
    const api = new EmporixProductApi({ authenticatedFetch } as unknown as EmporixApiInvoker, mockConfig);

    await expect(
      api.searchProducts({
        page: 0,
        size: 12,
        criteria: { id: '(prod-1)' },
        expand: ['template', 'parentVariant'],
      }),
    ).rejects.toThrow('Failed to search products: 503 no available server');
  });
});
