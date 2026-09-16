import type { Product } from '@/platform/services/model/product';

describe('getProductById', () => {
  async function loadModule() {
    jest.resetModules();

    const services = new Map<string, unknown>();

    jest.doMock('react', () => ({
      __esModule: true,
      cache: jest.fn((loader: (...args: unknown[]) => Promise<unknown>) => loader),
    }));

    jest.doMock('@/platform/ssr', () => ({
      __esModule: true,
      default: {
        get: jest.fn((id: string) => services.get(id)),
      },
    }));

    const [{ getProductById }, { default: BatteryIncludedSearchService }, { default: EmporixSearchService }] =
      await Promise.all([
        import('./products'),
        import('@/platform/services/search/impl/BatteryIncludedSearchService'),
        import('@/platform/services/search/impl/EmporixSearchService'),
      ]);

    return {
      getProductById,
      BatteryIncludedSearchService,
      EmporixSearchService,
      services,
    };
  }

  const product = { id: 'sku-123', name: { en: 'Widget' } } as unknown as Product;
  const options = { prices: false, variants: false, categories: false };

  it('calls SearchService.getCatalogProductById with id, options, locale, and site when BatteryIncluded is bound', async () => {
    const { getProductById, BatteryIncludedSearchService, services } = await loadModule();
    const searchService = new BatteryIncludedSearchService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const getCatalogProductById = jest.spyOn(searchService, 'getCatalogProductById').mockResolvedValue(product);
    const getProductByIdOnProductService = jest.fn();

    services.set('SearchService', searchService);
    services.set('ProductService', { getProductById: getProductByIdOnProductService });
    services.set('LoggerService', { error: jest.fn() });

    const result = await getProductById('sku-123', options, 'en', 'main');

    expect(getCatalogProductById).toHaveBeenCalledWith('sku-123', options, 'en', 'main');
    expect(getProductByIdOnProductService).not.toHaveBeenCalled();
    expect(result).toEqual(product);
  });

  it('still calls getCatalogProductById when EmporixSearchService is bound', async () => {
    const { getProductById, EmporixSearchService, services } = await loadModule();
    const searchService = new EmporixSearchService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const getCatalogProductById = jest.spyOn(searchService, 'getCatalogProductById').mockResolvedValue(product);
    const getProductByIdOnProductService = jest.fn();

    services.set('SearchService', searchService);
    services.set('ProductService', { getProductById: getProductByIdOnProductService });
    services.set('LoggerService', { error: jest.fn() });

    const result = await getProductById('sku-123', options, 'de', 'site-a');

    expect(getCatalogProductById).toHaveBeenCalledWith('sku-123', options, 'de', 'site-a');
    expect(getProductByIdOnProductService).not.toHaveBeenCalled();
    expect(result).toEqual(product);
  });

  it('returns undefined (not null) when catalog identity throws so the PDP can distinguish a load error from a miss', async () => {
    const { getProductById, BatteryIncludedSearchService, services } = await loadModule();
    const searchService = new BatteryIncludedSearchService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest
      .spyOn(searchService, 'getCatalogProductById')
      .mockRejectedValue(new Error('Failed to match prices: Not Found'));
    const logger = { error: jest.fn() };

    services.set('SearchService', searchService);
    services.set('ProductService', { getProductById: jest.fn() });
    services.set('LoggerService', logger);

    await expect(getProductById('sku-123', options, 'en', 'main')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns null when the catalog confirms a miss', async () => {
    const { getProductById, BatteryIncludedSearchService, services } = await loadModule();
    const searchService = new BatteryIncludedSearchService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(searchService, 'getCatalogProductById').mockResolvedValue(undefined);

    services.set('SearchService', searchService);
    services.set('ProductService', { getProductById: jest.fn() });
    services.set('LoggerService', { error: jest.fn() });

    await expect(getProductById('missing', options, 'en', 'main')).resolves.toBeNull();
  });
});
