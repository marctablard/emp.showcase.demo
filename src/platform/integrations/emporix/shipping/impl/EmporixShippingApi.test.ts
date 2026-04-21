import { Container } from 'inversify';
import { EmporixTokenManager as TokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import { EmporixFindSiteRequest, EmporixShippingMethod } from '../../model/shipping';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixShippingApi from './EmporixShippingApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || '';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
}

// Sample shipping method data for tests
const sampleShippingMethod: EmporixShippingMethod = {
  id: 'standard',
  name: { en: 'Standard Shipping' },
  fees: [{ minOrderValue: { amount: 5.0, currency: 'USD' }, cost: { amount: 5.0, currency: 'USD' } }],
};

describe('EmporixShippingApi', () => {
  let container: Container;
  let shippingApi: EmporixShippingApi;
  let apiInvoker: EmporixApiInvoker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<TokenManager>('EmporixTokenManager').to(EmporixTestTokenManager).inSingletonScope();
    container
      .bind<EmporixApiInvoker>('EmporixApiInvoker')
      .toDynamicValue(
        (ctx) =>
          new EmporixApiInvoker(ctx.get<EmporixConfig>('EmporixConfig'), ctx.get<TokenManager>('EmporixTokenManager')),
      )
      .inSingletonScope();
    container.bind<EmporixShippingApi>('EmporixShippingApi').to(EmporixShippingApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    shippingApi = container.get<EmporixShippingApi>('EmporixShippingApi');

    // Mock the authenticatedFetch method on the real apiInvoker
    jest.spyOn(apiInvoker, 'authenticatedFetch');
  });

  describe('getShippingMethod', () => {
    it('should fetch a shipping method by ID', async () => {
      // Setup
      const siteId = 'main';
      const zoneId = 'de-default';
      const methodId = 'standard';

      // Execute
      const result = await shippingApi.getShippingMethod(siteId, zoneId, methodId);
      // Assert
      expect(result).toBeDefined();
      if (result) {
        expect(result.id).toBeDefined();
        expect(result.name).toBeDefined();
      }
    });

    it('should return undefined when shipping method not found', async () => {
      // Setup
      const siteId = 'main';
      const zoneId = 'de-default';
      const methodId = 'non-existent-method';
      // Mock response
      (apiInvoker.authenticatedFetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // Execute
      const result = await shippingApi.getShippingMethod(siteId, zoneId, methodId);
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getShippingMethods', () => {
    it('should fetch all shipping methods for a zone', async () => {
      // Setup
      const siteId = 'main';
      const zoneId = 'de-region';

      // Execute
      const result = await shippingApi.getShippingMethods(siteId, zoneId);
      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findSite', () => {
    it('should find sites based on location', async () => {
      // Setup
      const request: EmporixFindSiteRequest = {
        postalCode: '10115',
        country: 'DE',
      };

      // Execute
      const result = await shippingApi.findSite(request);
      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].id).toBeDefined();
        expect(result[0].zones).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should handle API errors in getShippingMethods', async () => {
      // Setup
      const siteId = 'main';
      const zoneId = 'de-default';
      // Mock response
      (apiInvoker.authenticatedFetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      // Execute and assert
      await expect(shippingApi.getShippingMethods(siteId, zoneId)).rejects.toThrow('API Error');
    });

    it('should handle API errors in findSite', async () => {
      // Setup
      const request: EmporixFindSiteRequest = {
        postalCode: '10115',
        country: 'DE',
      };

      // Mock response
      (apiInvoker.authenticatedFetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      // Execute and assert
      await expect(shippingApi.findSite(request)).rejects.toThrow('API Error');
    });
  });
});
