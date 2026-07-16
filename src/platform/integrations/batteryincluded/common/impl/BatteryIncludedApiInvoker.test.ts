import type { BatteryIncludedConfig, BatteryIncludedRuntimeConfig } from '../../config';
import BatteryIncludedApiInvoker from './BatteryIncludedApiInvoker';
import BatteryIncludedApiInvokerSSR from './BatteryIncludedApiInvokerSSR';
import BatteryIncludedApiInvokerServer from './BatteryIncludedApiInvokerServer';

jest.mock('@/platform/core/utils/debug-utils', () => ({
  buildAndLogCurl: jest.fn(() => '[BI]'),
  getDebugLogger: jest.fn(() => ({ error: jest.fn() })),
  logRequestPayload: jest.fn(),
  logResponse: jest.fn(),
}));

const { buildAndLogCurl, logRequestPayload, logResponse } = jest.requireMock('@/platform/core/utils/debug-utils') as {
  buildAndLogCurl: jest.Mock;
  logRequestPayload: jest.Mock;
  logResponse: jest.Mock;
};

// Mock fetch
global.fetch = jest.fn();

describe('BatteryIncludedApiInvoker', () => {
  let apiInvoker: BatteryIncludedApiInvoker;
  let mockConfig: BatteryIncludedConfig;
  let runtimeConfig: BatteryIncludedRuntimeConfig;

  beforeEach(() => {
    // Reset mocks
    (global.fetch as jest.Mock).mockReset();
    buildAndLogCurl.mockClear();
    logRequestPayload.mockClear();
    logResponse.mockClear();

    // Create mock config
    runtimeConfig = {
      apiKey: 'test-api-key',
      collection: 'test-collection',
    };

    mockConfig = {
      baseUrl: 'https://api.batteryincluded.com',
      getRuntimeConfig: jest.fn().mockResolvedValue(runtimeConfig),
    };

    // Create API invoker instance
    apiInvoker = new BatteryIncludedApiInvoker(mockConfig);
  });

  describe('apiFetch', () => {
    it('should call fetch with the correct URL and headers', async () => {
      // Mock fetch response
      const mockResponse = { status: 200, json: jest.fn() };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Call the method
      const url = '/api/v1/collections/test-collection/documents/browse';
      const options = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      };

      await apiInvoker.apiFetch(url, options);

      // Check fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.batteryincluded.com/api/v1/collections/test-collection/documents/browse',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-BI-API-KEY': 'test-api-key',
          },
        },
      );
    });

    it('should add API key header to requests without existing headers', async () => {
      // Mock fetch response
      const mockResponse = { status: 200, json: jest.fn() };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Call the method with no headers
      const url = '/api/v1/collections/test-collection/documents/browse';

      await apiInvoker.apiFetch(url);

      // Check fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.batteryincluded.com/api/v1/collections/test-collection/documents/browse',
        {
          headers: {
            'X-BI-API-KEY': 'test-api-key',
          },
        },
      );
    });

    it('should return the fetch response', async () => {
      // Mock fetch response
      const mockResponse = { status: 200, json: jest.fn() };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Call the method
      const result = await apiInvoker.apiFetch('test-url');

      // Check result
      expect(result).toBe(mockResponse);
    });

    it('uses the provided runtime config without reloading it', async () => {
      const mockResponse = { status: 200, json: jest.fn() };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await apiInvoker.apiFetch('/api/v1/collections/test-collection/documents/browse', undefined, runtimeConfig);

      expect(mockConfig.getRuntimeConfig).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.batteryincluded.com/api/v1/collections/test-collection/documents/browse',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-BI-API-KEY': 'test-api-key',
          }),
        }),
      );
    });

    it('uses client debug source for the server container invoker', async () => {
      const mockResponse = { status: 200, ok: true, json: jest.fn() } as Response;
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const serverInvoker = new BatteryIncludedApiInvokerServer(mockConfig);

      await serverInvoker.apiFetch('/api/v1/test');

      expect(buildAndLogCurl).toHaveBeenCalledWith(
        'https://api.batteryincluded.com/api/v1/test',
        expect.any(Object),
        expect.objectContaining({ callType: 'external', source: 'client' }),
      );
      expect(logRequestPayload.mock.calls[0]?.[3]).toEqual(
        expect.objectContaining({ callType: 'external', source: 'client' }),
      );
      expect(logResponse.mock.calls[0]?.[4]).toEqual(
        expect.objectContaining({ callType: 'external', source: 'client' }),
      );
    });

    it('uses ssr debug source for the SSR container invoker', async () => {
      const mockResponse = { status: 200, ok: true, json: jest.fn() } as Response;
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const ssrInvoker = new BatteryIncludedApiInvokerSSR(mockConfig);

      await ssrInvoker.apiFetch('/api/v1/test');

      expect(buildAndLogCurl).toHaveBeenCalledWith(
        'https://api.batteryincluded.com/api/v1/test',
        expect.any(Object),
        expect.objectContaining({ callType: 'external', source: 'ssr' }),
      );
    });
  });
});
