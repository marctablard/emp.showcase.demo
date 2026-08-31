import { DEFAULT_CACHE_REVALIDATE } from '../common/cache-defaults';
import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import type { EmporixTaxConfiguration } from '../model/tax';
import EmporixTaxApi from './impl/EmporixTaxApi';

type AuthenticatedFetch = (
  ...args: Parameters<EmporixApiInvoker['authenticatedFetch']>
) => ReturnType<EmporixApiInvoker['authenticatedFetch']>;

type MockTaxApiClient = {
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

const chTaxConfiguration: EmporixTaxConfiguration = {
  locationCode: 'CH',
  location: { countryCode: 'CH' },
  taxClasses: [
    { code: 'STANDARD', name: 'Standard', rate: 7.7, isDefault: true },
    { code: 'REDUCED', name: 'Reduced', rate: 3.7 },
  ],
};

const okResponse = (body: unknown = chTaxConfiguration) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: jest.fn().mockResolvedValue(body),
});

describe('EmporixTaxApi (mocked)', () => {
  it('GETs /tax/{tenant}/taxes/{locationCode} with service token and tax.tax_read', async () => {
    const mockApiClient: MockTaxApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(okResponse()),
    };
    const api = new EmporixTaxApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    const result = await api.getTaxConfiguration('CH');

    expect(result).toEqual(chTaxConfiguration);
    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [url, options, tokenType, authOptions, metrics, cacheSeconds] =
      mockApiClient.authenticatedFetch.mock.calls[0];
    const parsedUrl = new URL(url, 'https://api.emporix.io');

    expect(parsedUrl.pathname).toBe('/tax/test-tenant/taxes/CH');
    expect(options).toEqual({ method: 'GET' });
    expect(tokenType).toBe('service');
    expect(authOptions).toEqual({ scopes: ['tax.tax_read'] });
    expect(metrics).toEqual({ source: 'tax', routePattern: '/tax/{tenant}/taxes/{locationCode}' });
    expect(cacheSeconds).toBe(DEFAULT_CACHE_REVALIDATE);
  });

  it('returns null when the tax configuration is not found', async () => {
    const mockApiClient: MockTaxApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: jest.fn(),
      }),
    };
    const api = new EmporixTaxApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await expect(api.getTaxConfiguration('XX')).resolves.toBeNull();
  });

  it('throws when the tax configuration response is not ok', async () => {
    const mockApiClient: MockTaxApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: jest.fn(),
      }),
    };
    const api = new EmporixTaxApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await expect(api.getTaxConfiguration('CH')).rejects.toThrow('Failed to get tax configuration: Forbidden');
  });
});
