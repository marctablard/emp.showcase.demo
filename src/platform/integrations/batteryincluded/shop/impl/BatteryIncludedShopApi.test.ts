import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type BatteryIncludedApiInvoker from '../../common/impl/BatteryIncludedApiInvoker';
import type { BatteryIncludedConfig, BatteryIncludedRuntimeConfig } from '../../config';
import { BatteryIncludedSearchResponse } from '../../model';
import BatteryIncludedShopApi from './BatteryIncludedShopApi';

describe('BatteryIncludedShopApi', () => {
  let shopApi: BatteryIncludedShopApi;
  let apiInvoker: jest.Mocked<Pick<BatteryIncludedApiInvoker, 'apiFetch'>>;
  let config: BatteryIncludedConfig;
  let runtimeConfig: BatteryIncludedRuntimeConfig;
  let logger: LoggerService;

  const createJsonResponse = (body: unknown, status: number = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  beforeEach(() => {
    jest.clearAllMocks();

    runtimeConfig = {
      apiKey: 'test-api-key',
      collection: 'test-collection',
    };
    apiInvoker = {
      apiFetch: jest.fn(),
    };
    config = {
      baseUrl: 'https://api.batteryincluded.com',
      getRuntimeConfig: jest.fn().mockResolvedValue(runtimeConfig),
    };
    logger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };

    shopApi = new BatteryIncludedShopApi(apiInvoker as unknown as BatteryIncludedApiInvoker, config, logger);
  });

  describe('browse', () => {
    it('should call API with default parameters', async () => {
      apiInvoker.apiFetch.mockResolvedValue(createJsonResponse({ hits: [], found: 0, page: 1, facet_counts: [] }));

      // Execute
      const result: BatteryIncludedSearchResponse<any> = await shopApi.browse({ query: 'power' });

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/collections/${runtimeConfig.collection}/documents/browse`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
        runtimeConfig,
      );

      expect(result.hits).toBeDefined();
      expect(result.found).toBeDefined();
      expect(result.page).toBeDefined();
    });

    it('should call API with custom parameters', async () => {
      apiInvoker.apiFetch.mockResolvedValue(createJsonResponse({ hits: [], found: 0, page: 1, facet_counts: [] }));

      // Execute
      const result = await shopApi.browse({
        query: 'power',
        page: 1,
        size: 10,
        locale: 'en',
        sort: 'popularity:desc',
      });

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/collections/${runtimeConfig.collection}/documents/browse`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
        runtimeConfig,
      );

      // Get the URL from the call
      const url = apiInvoker.apiFetch.mock.calls[0][0];

      // Verify URL parameters
      expect(url).toContain('page=1');
      expect(url).toContain('per_page=10');
      expect(url).toContain('sort=popularity%3Adesc');
      expect(url).toContain('v%5Blocale%5D=en');
      expect(url).toContain('q=power');

      expect(result.hits).toBeDefined();
    });

    it('should call API with the grounded category-tree bootstrap request', async () => {
      apiInvoker.apiFetch.mockResolvedValue(createJsonResponse({ hits: [], found: 0, page: 0, facet_counts: [] }));

      await shopApi.browseCategoryTreeBootstrap({
        locale: 'en',
        siteCode: 'main',
        country: 'DE',
      });

      const url = apiInvoker.apiFetch.mock.calls[0][0];
      expect(url).toContain('q=');
      expect(url).toContain('page=0');
      expect(url).toContain('per_page=0');
      expect(url).toContain('variants=0');
      expect(url).toContain('analyze=1');
      expect(url).toContain('v%5Blocale%5D=en');
      expect(url).toContain('v%5BsiteAware%5D=main');
      expect(url).toContain('v%5BcountryAware%5D=DE');
    });
  });

  describe('suggest', () => {
    it('should call API with the BI suggest variable context', async () => {
      apiInvoker.apiFetch.mockResolvedValue(createJsonResponse([]));

      // Execute
      await shopApi.suggest({
        query: 'pho',
        variables: {
          locale: 'en',
          siteAware: 'main',
          countryAware: 'DE',
          currencyAware: 'EUR',
        },
        segmentIds: ['segment-a', 'segment-b'],
      });

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/collections/${runtimeConfig.collection}/documents/suggest`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
        runtimeConfig,
      );

      // Get the URL from the call
      const url = apiInvoker.apiFetch.mock.calls[0][0];

      // Verify URL parameters
      expect(url).toContain('q=pho');
      expect(url).toContain('v%5Blocale%5D=en');
      expect(url).toContain('v%5BsiteAware%5D=main');
      expect(url).toContain('v%5BcountryAware%5D=DE');
      expect(url).toContain('v%5BcurrencyAware%5D=EUR');
      expect(url).toContain('f%5BsegmentIds%5D%5B%5D=segment-a');
      expect(url).toContain('f%5BsegmentIds%5D%5B%5D=segment-b');
      expect(url).not.toContain('f%5BsegmentIds%5D%5B%5D=segment-a%2Csegment-b');
    });
  });

  describe('getHighlights', () => {
    it('should call API with correct parameters', async () => {
      apiInvoker.apiFetch.mockResolvedValue(createJsonResponse({ highlights: [] }));

      // Execute
      await shopApi.getHighlights();

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        `/api/v1/collections/${runtimeConfig.collection}/documents/highlights`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
        runtimeConfig,
      );
    });
  });

  describe('getRecommendations', () => {
    it('should build recommendations URL from runtime config and forward the runtime config to apiFetch', async () => {
      const recommendationId = 'product/sku 1';
      const expectedQuery = new URLSearchParams({ id: recommendationId }).toString();
      apiInvoker.apiFetch.mockResolvedValue(createJsonResponse([]));

      await shopApi.getRecommendations(recommendationId);

      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        `/api/v1/collections/${runtimeConfig.collection}/documents/recommendations?${expectedQuery}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
        runtimeConfig,
      );
    });
  });

  describe('getPresets', () => {
    it('should call API with correct parameters', async () => {
      apiInvoker.apiFetch.mockResolvedValue(createJsonResponse({ presets: [] }));

      // Execute
      await shopApi.getPresets();

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        `/api/v1/collections/${runtimeConfig.collection}/documents/presets`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
        runtimeConfig,
      );
    });
  });
});
