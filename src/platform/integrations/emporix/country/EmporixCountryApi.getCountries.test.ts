import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixCountryApi, { DEFAULT_COUNTRIES_PAGE_SIZE } from './impl/EmporixCountryApi';

type AuthenticatedFetch = (
  ...args: Parameters<EmporixApiInvoker['authenticatedFetch']>
) => ReturnType<EmporixApiInvoker['authenticatedFetch']>;

type MockCountryApiClient = {
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

const okResponse = (body: unknown = [{ code: 'DE', name: 'Germany', active: true }]) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: jest.fn().mockResolvedValue(body),
});

describe('EmporixCountryApi.getCountries (mocked)', () => {
  it('exports DEFAULT_COUNTRIES_PAGE_SIZE as 300', () => {
    expect(DEFAULT_COUNTRIES_PAGE_SIZE).toBe(300);
  });

  it('requests pageSize=300 and active=true for getCountries(true)', async () => {
    const mockApiClient: MockCountryApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(okResponse()),
    };
    const api = new EmporixCountryApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await api.getCountries(true);

    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
    const parsedUrl = new URL(url, 'https://api.emporix.io');

    expect(parsedUrl.pathname).toBe('/country/test-tenant/countries');
    expect(parsedUrl.searchParams.get('pageSize')).toBe(String(DEFAULT_COUNTRIES_PAGE_SIZE));
    expect(parsedUrl.searchParams.get('active')).toBe('true');
    expect(options).toEqual({
      method: 'GET',
      headers: {
        'X-Version': 'v2',
        'Accept-Language': '*',
      },
    });
    expect(tokenType).toBe('public');
  });

  it('requests pageSize=300 without active when getCountries() has no args', async () => {
    const mockApiClient: MockCountryApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue(okResponse()),
    };
    const api = new EmporixCountryApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await api.getCountries();

    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];
    const parsedUrl = new URL(url, 'https://api.emporix.io');

    expect(parsedUrl.pathname).toBe('/country/test-tenant/countries');
    expect(parsedUrl.searchParams.get('pageSize')).toBe(String(DEFAULT_COUNTRIES_PAGE_SIZE));
    expect(parsedUrl.searchParams.has('active')).toBe(false);
    expect(options).toEqual({
      method: 'GET',
      headers: {
        'X-Version': 'v2',
        'Accept-Language': '*',
      },
    });
    expect(tokenType).toBe('public');
  });

  it('throws when the country list response is not ok', async () => {
    const mockApiClient: MockCountryApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn(),
      }),
    };
    const api = new EmporixCountryApi(mockApiClient as unknown as EmporixApiInvoker, mockConfig);

    await expect(api.getCountries()).rejects.toThrow('Failed to get countries: Internal Server Error');
  });
});
