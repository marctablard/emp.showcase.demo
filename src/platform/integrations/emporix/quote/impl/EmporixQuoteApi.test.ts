import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import EmporixQuoteApi from './EmporixQuoteApi';

// Mock buildSearchQuery and buildPaginatedResponse
jest.mock('../../common/util/common', () => ({
  buildSearchQuery: jest.fn().mockReturnValue({ body: 'customer.customerId:cust-1', query: 'pageNumber=1' }),
  buildPaginatedResponse: jest.fn().mockResolvedValue({ items: [], page: 1, total: 0 }),
}));

const mockConfig: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'test-tenant',
  clientId: 'test-client-id',
  clientSecret: '',
  serverClientId: '',
  serverClientSecret: '',
};

describe('EmporixQuoteApi', () => {
  let quoteApi: EmporixQuoteApi;
  let mockApiClient: jest.Mocked<EmporixApiInvoker>;

  beforeEach(() => {
    mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn().mockResolvedValue(''),
        headers: new Headers({ 'x-total-count': '0' }),
      }),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    quoteApi = new EmporixQuoteApi(mockApiClient, mockConfig);
  });

  describe('getQuotes', () => {
    it('should pass cache: no-store to prevent stale cached responses', async () => {
      await quoteApi.getQuotes({ page: 1, size: 10 });

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(options).toEqual(
        expect.objectContaining({
          cache: 'no-store',
          method: 'GET',
        }),
      );
      expect(tokenType).toBe('service');
    });
  });

  describe('getQuote', () => {
    it('should NOT set cache option (relies on session token default)', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'Q1000141', status: 'OPEN' }),
        text: jest.fn(),
      } as unknown as Response);

      await quoteApi.getQuote('Q1000141');

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(options).not.toHaveProperty('cache');
      expect(tokenType).toBe('session');
    });
  });

  describe('getQuoteHistory', () => {
    it('should pass cache: no-store to prevent stale cached responses', async () => {
      mockApiClient.authenticatedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
        text: jest.fn(),
      } as unknown as Response);

      await quoteApi.getQuoteHistory('Q1000141');

      expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
      const [, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
      expect(options).toEqual(
        expect.objectContaining({
          cache: 'no-store',
          method: 'GET',
        }),
      );
      expect(tokenType).toBe('service');
    });
  });
});
