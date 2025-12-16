import { Container } from 'inversify';
import { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import { EmporixProduct, EmporixSearchParams } from '../../model';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixProductApi from './EmporixProductApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || '';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
}

const sampleSingleProduct: EmporixProduct = {
  id: '1',
  code: 'c1',
  name: { en: 'Test Product 1 EN' },
  description: { en: 'Test Product 1 Description EN' },
  published: true,
};

// Sample product data for tests
const sampleProductsData: EmporixProduct[] = [
  sampleSingleProduct,
  {
    id: '2',
    code: 'c2',
    name: { en: 'Test Product 2 EN' },
    description: { en: 'Test Product 2 Description EN' },
    published: true,
  },
];

describe('EmporixProductApi', () => {
  let container: Container;
  let productApi: EmporixProductApi;
  let apiInvoker: EmporixApiInvoker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the container with our test config
    container = new Container();
    const test = new TestEmporixConfig();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(EmporixTestTokenManager);
    container.bind<EmporixApiInvoker>('EmporixApiInvoker').to(EmporixApiInvoker);
    container.bind<EmporixProductApi>('EmporixProductApi').to(EmporixProductApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    productApi = container.get<EmporixProductApi>('EmporixProductApi');

    // Mock the authenticatedFetch method on the real apiInvoker
    jest.spyOn(apiInvoker, 'authenticatedFetch');
  });

  describe('getProducts', () => {
    it('should fetch products with default pagination parameters', async () => {
      // Setup mocks
      const mockQuery = 'pageSize=20';
      // Execute
      const result = await productApi.getProducts();

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });

    it('should fetch products with custom pagination parameters', async () => {
      // Execute
      const result = await productApi.getProducts(2, 1);

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.page).toBe(2);
      expect(result.size).toBe(1);
      expect(result.total).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('searchProducts', () => {
    it('should search products with provided search parameters', async () => {
      // Setup mocks
      const searchParams: EmporixSearchParams<EmporixProduct> = {
        page: 1,
        size: 20,
        criteria: {
          name: '~Test',
        },
      };

      // Execute
      const result = await productApi.searchProducts(searchParams);

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
      expect(result.total).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('getProduct', () => {
    it('should fetch a single product by ID', async () => {
      // Setup mocks
      const productId = '1';

      // Execute
      const result = await productApi.getProduct(productId);
      if (!result) {
        fail('Product not found');
      }

      expect(result.id).toEqual(sampleSingleProduct.id);
      expect(result.code).toEqual(sampleSingleProduct.code);
      expect(result.name).toEqual(sampleSingleProduct.name);
      expect(result.description).toEqual(sampleSingleProduct.description);
    });

    it('should handle errors when fetching a product', async () => {
      // Setup mocks
      const productId = 'non-existent-product';
      const result = await productApi.getProduct(productId);
      // Execute and assert
      expect(result).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle API errors in getProducts', async () => {
      // Setup mocks
      (apiInvoker.authenticatedFetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      // Execute and assert
      await expect(productApi.getProducts()).rejects.toThrow('API Error');
    });

    it('should handle API errors in searchProducts', async () => {
      // Setup mocks
      (apiInvoker.authenticatedFetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      // Execute and assert
      await expect(
        productApi.searchProducts({
          query: 'test',
        }),
      ).rejects.toThrow('API Error');
    });
  });
});
