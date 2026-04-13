import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixQuoteApi from './impl/EmporixQuoteApi';

const mockConfig: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'test-tenant',
  clientId: 'test-client-id',
  clientSecret: '',
  serverClientId: '',
  serverClientSecret: '',
};

describe('EmporixQuoteApi.patchQuote error message', () => {
  it('includes quoteId and first op path when PATCH fails', async () => {
    const mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('{"message":"Missing field"}'),
      } as unknown as Response),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    const quoteApi = new EmporixQuoteApi(mockApiClient, mockConfig);
    const ops = [{ op: 'REPLACE', path: '/mixins/additionalInfo', value: {} }];

    await expect(quoteApi.patchQuote('Q-123', ops, 'service')).rejects.toThrow(
      'Failed to update quote Q-123 (/mixins/additionalInfo): Bad Request',
    );
  });
});
