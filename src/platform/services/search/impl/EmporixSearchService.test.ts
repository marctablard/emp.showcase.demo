/**
 * @jest-environment jsdom
 */
import EmporixSearchService from './EmporixSearchService';

describe('EmporixSearchService', () => {
  const productApi = {
    searchProducts: jest.fn(),
  };
  const productMapper = {
    mapToService: jest.fn((product) => ({ id: product.id })),
  };
  const sessionService = {
    getCurrent: jest.fn().mockResolvedValue({ currency: 'USD' }),
  };
  const productService = {
    addAdditionalData: jest.fn((products) => products),
    getProductById: jest.fn(),
  };
  const segmentFilterService = {
    filterByCustomerSegments: jest.fn(async (products) => products),
  };
  const categoryService = {
    getNavigationCategoryTrees: jest.fn(),
  };
  const logger = {
    warn: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    productApi.searchProducts.mockResolvedValue({
      items: [{ id: 'product-1', name: { en: 'Alpha' } }],
      page: 1,
      size: 12,
      total: 1,
    });
  });

  it('exposes a safe product-name sort option while forwarding the raw sort token upstream', async () => {
    const service = new EmporixSearchService(
      sessionService as never,
      productApi as never,
      productMapper as never,
      productService as never,
      segmentFilterService as never,
      categoryService as never,
      logger as never,
    );

    const result = await service.searchProducts(
      {
        page: 0,
        size: 12,
        sort: 'name:asc',
        searchAllProducts: true,
      },
      'en',
      'main',
    );

    expect(productApi.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'name:asc',
        criteria: {},
      }),
    );
    expect(result.availableSorts).toEqual([
      {
        id: 'name',
        labelKey: 'name',
        directions: ['asc', 'desc'],
        defaultDirection: 'asc',
      },
    ]);
  });

  it('delegates getCatalogProductById to ProductService.getProductById only', async () => {
    const catalogProduct = { id: 'product-1', name: { en: 'Alpha' } };
    productService.getProductById.mockResolvedValue(catalogProduct);

    const service = new EmporixSearchService(
      sessionService as never,
      productApi as never,
      productMapper as never,
      productService as never,
      segmentFilterService as never,
      categoryService as never,
      logger as never,
    );

    const options = { prices: true, variants: true };
    const result = await service.getCatalogProductById('product-1', options, 'en', 'main');

    expect(productService.getProductById).toHaveBeenCalledTimes(1);
    expect(productService.getProductById).toHaveBeenCalledWith('product-1', options);
    expect(productApi.searchProducts).not.toHaveBeenCalled();
    expect(result).toEqual(catalogProduct);
  });
});
