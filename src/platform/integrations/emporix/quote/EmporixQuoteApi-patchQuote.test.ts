import type { LoggerService } from '@/platform/services/logger/LoggerService';
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
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('{"message":"Missing field"}'),
      } as unknown as Response),
    } as unknown as jest.Mocked<EmporixApiInvoker>;
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as LoggerService;

    const quoteApi = new EmporixQuoteApi(mockApiClient, mockConfig, logger);
    const ops = [{ op: 'REPLACE', path: '/mixins/additionalInfo', value: {} }];

    await expect(quoteApi.patchQuote('Q-123', ops, 'service')).rejects.toThrow(
      'Failed to update quote Q-123 (/mixins/additionalInfo) failed with upstream status 400 Bad Request: {"message":"Missing field"}',
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/quote/test-tenant/quotes/Q-123',
        operationCount: 1,
        hasResponseBody: true,
        responseBodyLength: '{"message":"Missing field"}'.length,
      }),
      'Emporix quote patch failed',
    );
  });
});
