import { Container } from 'inversify';
import { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixAvailabilityApi from './EmporixAvailabilityApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || '';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
}

// Sample site for testing
const testSite = 'default';
const testProductId = '1'; // Use a product ID that exists in your test environment

describe('EmporixAvailabilityApi', () => {
  let container: Container;
  let availabilityApi: EmporixAvailabilityApi;
  let apiInvoker: EmporixApiInvoker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(EmporixTestTokenManager).inSingletonScope();
    container
      .bind<EmporixApiInvoker>('EmporixApiInvoker')
      .toDynamicValue(
        (ctx) =>
          new EmporixApiInvoker(
            ctx.get<EmporixConfig>('EmporixConfig'),
            ctx.get<EmporixTokenManager>('EmporixTokenManager'),
          ),
      )
      .inSingletonScope();
    container.bind<EmporixAvailabilityApi>('EmporixAvailabilityApi').to(EmporixAvailabilityApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    availabilityApi = container.get<EmporixAvailabilityApi>('EmporixAvailabilityApi');

    // Mock the authenticatedFetch method on the real apiInvoker
    jest.spyOn(apiInvoker, 'authenticatedFetch');
  });

  describe('getAvailabilitiesBySite', () => {
    it('should fetch availabilities with default pagination parameters', async () => {
      // Execute
      const result = await availabilityApi.getAvailabilitiesBySite(testSite);

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
      expect(result.total).toBeDefined();
    });

    it('should fetch availabilities with custom pagination parameters', async () => {
      // Execute
      const result = await availabilityApi.getAvailabilitiesBySite(testSite, 2, 5);

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.page).toBe(2);
      expect(result.size).toBe(5);
      expect(result.total).toBeDefined();
    });
  });

  describe('searchProductAvailabilities', () => {
    it('should search product availabilities with provided product IDs', async () => {
      // Setup
      const productIds = [testProductId];

      // Execute
      const result = await availabilityApi.searchProductAvailabilities(testSite, productIds);

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
      expect(result.total).toBeDefined();
    });

    it('should search product availabilities with custom pagination', async () => {
      // Setup
      const productIds = [testProductId];

      // Execute
      const result = await availabilityApi.searchProductAvailabilities(testSite, productIds, 1, 5);

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.size).toBe(5);
      expect(result.total).toBeDefined();
    });
  });

  describe('getProductAvailability', () => {
    it('should fetch a single product availability', async () => {
      // Execute
      const result = await availabilityApi.getProductAvailability(testProductId, testSite);

      // Assert
      if (result) {
        expect(result.productId).toEqual(testProductId);
        expect(result.site).toEqual(testSite);
        expect(result.id).toBeDefined();
        expect(typeof result.available).toBe('boolean');
        expect(typeof result.stockLevel).toBe('number');
      }
    });

    it('should return undefined for non-existent product', async () => {
      // Execute
      const result = await availabilityApi.getProductAvailability('non-existent-product', testSite);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle API errors in getAvailabilitiesBySite', async () => {
      // Setup
      (apiInvoker.authenticatedFetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      // Execute and assert
      await expect(availabilityApi.getAvailabilitiesBySite(testSite)).rejects.toThrow('API Error');
    });

    it('should handle API errors in searchProductAvailabilities', async () => {
      // Setup
      (apiInvoker.authenticatedFetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      // Execute and assert
      await expect(availabilityApi.searchProductAvailabilities(testSite, [testProductId])).rejects.toThrow('API Error');
    });
  });
});
