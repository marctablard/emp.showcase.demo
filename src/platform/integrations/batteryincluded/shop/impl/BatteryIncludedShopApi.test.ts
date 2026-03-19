import { Container } from 'inversify';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import BatteryIncludedApiInvoker from '../../common/impl/BatteryIncludedApiInvoker';
import type { BatteryIncludedConfig } from '../../config';
import { BatteryIncludedSearchResponse } from '../../model';
import BatteryIncludedShopApi from './BatteryIncludedShopApi';

// Create a test config implementation using environment variables
class TestBatteryIncludedConfig implements BatteryIncludedConfig {
  baseUrl: string = process.env.NEXT_PUBLIC_BATTERY_INCLUDED_BASE_URL || 'https://api.batteryincluded.com';
  apiKey: string = process.env.NEXT_PUBLIC_BATTERY_INCLUDED_API_KEY || '';
  collection: string = process.env.NEXT_PUBLIC_BATTERY_INCLUDED_COLLECTION || '';
}

describe('BatteryIncludedShopApi', () => {
  let container: Container;
  let shopApi: BatteryIncludedShopApi;
  let apiInvoker: BatteryIncludedApiInvoker;
  let config: BatteryIncludedConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the container with our test config
    container = new Container();
    container.bind<BatteryIncludedConfig>('BatteryIncludedConfig').to(TestBatteryIncludedConfig);
    container.bind<BatteryIncludedApiInvoker>('BatteryIncludedApiInvoker').to(BatteryIncludedApiInvoker);
    container.bind<LoggerService>('LoggerService').toConstantValue({
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    });
    container.bind<BatteryIncludedShopApi>('BatteryIncludedShopApi').to(BatteryIncludedShopApi);

    // Get instances from the container
    apiInvoker = container.get<BatteryIncludedApiInvoker>('BatteryIncludedApiInvoker');
    shopApi = container.get<BatteryIncludedShopApi>('BatteryIncludedShopApi');
    config = container.get<BatteryIncludedConfig>('BatteryIncludedConfig');

    // Mock the apiFetch method on the real apiInvoker
    jest.spyOn(apiInvoker, 'apiFetch');
  });

  describe('browse', () => {
    it('should call API with default parameters', async () => {
      // Execute
      const result: BatteryIncludedSearchResponse<any> = await shopApi.browse({ query: 'power' });

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/collections/${config.collection}/documents/browse`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      );

      expect(result.hits).toBeDefined();
      expect(result.found).toBeDefined();
      expect(result.page).toBeDefined();
    });

    it('should call API with custom parameters', async () => {
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
        expect.stringContaining(`/api/v1/collections/${config.collection}/documents/browse`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      );

      // Get the URL from the call
      const url = (apiInvoker.apiFetch as jest.Mock).mock.calls[0][0];

      // Verify URL parameters
      expect(url).toContain('page=1');
      expect(url).toContain('per_page=10');
      expect(url).toContain('sort=popularity%3Adesc');
      expect(url).toContain('v%5Blocale%5D=en');
      expect(url).toContain('q=power');

      expect(result.hits).toBeDefined();
    });
  });

  describe('suggest', () => {
    it('should call API with correct parameters', async () => {
      // Execute
      await shopApi.suggest('pho', 'en');

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/collections/${config.collection}/documents/suggest`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      );

      // Get the URL from the call
      const url = (apiInvoker.apiFetch as jest.Mock).mock.calls[0][0];

      // Verify URL parameters
      expect(url).toContain('q=pho');
      expect(url).toContain('v%5Blocale%5D=en');
    });
  });

  describe('getHighlights', () => {
    it('should call API with correct parameters', async () => {
      // Execute
      await shopApi.getHighlights();

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        `/api/v1/collections/${config.collection}/documents/highlights`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      );
    });
  });

  describe('getRecommendations', () => {
    it('should call API with product ID', async () => {
      /*
      TODO need to clarify required ID, it's not the product code
      // Execute
      await shopApi.getRecommendations('product1');
      
      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/collections/${config.collection}/documents/recommendations`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'Accept': 'application/json' })
        })
      );
      
      // Get the URL from the call
      const url = (apiInvoker.apiFetch as jest.Mock).mock.calls[0][0];
      
      // Verify URL parameters
      expect(url).toContain('id=product1');
      */
    });
  });

  describe('getPresets', () => {
    it('should call API with correct parameters', async () => {
      // Execute
      await shopApi.getPresets();

      // Verify
      expect(apiInvoker.apiFetch).toHaveBeenCalledWith(
        `/api/v1/collections/${config.collection}/documents/presets`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      );
    });
  });
});
