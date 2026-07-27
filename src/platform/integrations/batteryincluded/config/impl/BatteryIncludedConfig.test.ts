import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import BatteryIncludedConfig from './BatteryIncludedConfig';

describe('BatteryIncludedConfig', () => {
  let emporixApiInvoker: jest.Mocked<Pick<EmporixApiInvoker, 'authenticatedFetch'>>;
  let emporixConfig: EmporixConfig;
  let logger: LoggerService;

  const createConfig = () =>
    new BatteryIncludedConfig(emporixApiInvoker as unknown as EmporixApiInvoker, emporixConfig, logger);

  beforeEach(() => {
    jest.useRealTimers();
    emporixApiInvoker = {
      authenticatedFetch: jest.fn(),
    };
    emporixConfig = {
      baseUrl: 'https://api.emporix.io',
      tenant: 'showcasedev',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      serverClientId: 'server-client-id',
      serverClientSecret: 'server-client-secret',
    };
    logger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };
  });

  it('maps the BatteryIncluded public indexing configuration from Emporix', async () => {
    emporixApiInvoker.authenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          searchKey: 'resolved-search-key',
          applicationId: 'customer.emporix.showcasedevnew',
          indexName: 'customer.emporix.showcasedevnew',
          provider: 'BATTERY_INCLUDED',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const config = createConfig();

    await expect(config.getRuntimeConfig()).resolves.toEqual({
      apiKey: 'resolved-search-key',
      collection: 'customer.emporix.showcasedevnew',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'BATTERY_INCLUDED',
        tenant: 'showcasedev',
        collection: 'customer.emporix.showcasedevnew',
        apiKeyPresent: true,
      }),
      'Resolved BatteryIncluded runtime configuration',
    );

    expect(emporixApiInvoker.authenticatedFetch).toHaveBeenCalledWith(
      '/indexing/showcasedev/public/configurations/BATTERY_INCLUDED',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
      'public',
    );
  });

  it('fails when the Emporix public indexing configuration is incomplete', async () => {
    emporixApiInvoker.authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify({ provider: 'BATTERY_INCLUDED', searchKey: 'resolved-search-key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const config = createConfig();

    await expect(config.getRuntimeConfig()).rejects.toThrow(
      'Emporix indexing configuration is missing BatteryIncluded searchKey or indexName',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'BATTERY_INCLUDED', tenant: 'showcasedev' }),
      'Emporix indexing configuration is missing BatteryIncluded search key or index name',
    );
  });

  it('reuses the cached runtime configuration until the TTL expires', async () => {
    jest.useFakeTimers();
    const config = createConfig();

    emporixApiInvoker.authenticatedFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            searchKey: 'resolved-search-key',
            indexName: 'customer.emporix.showcasedevnew',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            searchKey: 'next-search-key',
            indexName: 'customer.emporix.showcasedevnext',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    await expect(config.getRuntimeConfig()).resolves.toEqual({
      apiKey: 'resolved-search-key',
      collection: 'customer.emporix.showcasedevnew',
    });
    await expect(config.getRuntimeConfig()).resolves.toEqual({
      apiKey: 'resolved-search-key',
      collection: 'customer.emporix.showcasedevnew',
    });

    expect(emporixApiInvoker.authenticatedFetch).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_001);

    await expect(config.getRuntimeConfig()).resolves.toEqual({
      apiKey: 'next-search-key',
      collection: 'customer.emporix.showcasedevnext',
    });

    expect(emporixApiInvoker.authenticatedFetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent runtime configuration requests', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    emporixApiInvoker.authenticatedFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const config = createConfig();

    const firstRequest = config.getRuntimeConfig();
    const secondRequest = config.getRuntimeConfig();

    expect(emporixApiInvoker.authenticatedFetch).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      new Response(
        JSON.stringify({
          searchKey: 'resolved-search-key',
          indexName: 'customer.emporix.showcasedevnew',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(firstRequest).resolves.toEqual({
      apiKey: 'resolved-search-key',
      collection: 'customer.emporix.showcasedevnew',
    });
    await expect(secondRequest).resolves.toEqual({
      apiKey: 'resolved-search-key',
      collection: 'customer.emporix.showcasedevnew',
    });
  });

  it('fails on non-2xx responses and does not cache the failure', async () => {
    emporixApiInvoker.authenticatedFetch
      .mockResolvedValueOnce(
        new Response('indexing unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            searchKey: 'resolved-search-key',
            indexName: 'customer.emporix.showcasedevnew',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    const config = createConfig();

    await expect(config.getRuntimeConfig()).rejects.toThrow(
      'Failed to load BatteryIncluded runtime configuration: 503 Service Unavailable',
    );
    await expect(config.getRuntimeConfig()).resolves.toEqual({
      apiKey: 'resolved-search-key',
      collection: 'customer.emporix.showcasedevnew',
    });

    expect(emporixApiInvoker.authenticatedFetch).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'BATTERY_INCLUDED',
        status: 503,
        tenant: 'showcasedev',
      }),
      'Failed to load BatteryIncluded runtime configuration from Emporix indexing',
    );
  });

  it('fails on thrown fetch errors and does not cache the failure', async () => {
    emporixApiInvoker.authenticatedFetch.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          searchKey: 'resolved-search-key',
          indexName: 'customer.emporix.showcasedevnew',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const config = createConfig();

    await expect(config.getRuntimeConfig()).rejects.toThrow('network down');
    await expect(config.getRuntimeConfig()).resolves.toEqual({
      apiKey: 'resolved-search-key',
      collection: 'customer.emporix.showcasedevnew',
    });

    expect(emporixApiInvoker.authenticatedFetch).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'network down',
        provider: 'BATTERY_INCLUDED',
        tenant: 'showcasedev',
      }),
      'BatteryIncluded runtime configuration resolution failed',
    );
  });
});
