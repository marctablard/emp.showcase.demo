describe('getCachedNavigationCategoryTrees', () => {
  async function loadModule() {
    jest.resetModules();

    const services = new Map<string, unknown>();
    const getSessionForSite = jest.fn();

    jest.doMock('next/cache', () => ({
      __esModule: true,
      unstable_cache: jest.fn((loader: () => Promise<unknown>) => async () => loader()),
    }));

    jest.doMock('react', () => ({
      __esModule: true,
      cache: jest.fn((loader: (...args: unknown[]) => Promise<unknown>) => loader),
    }));

    jest.doMock('@/lib/ssr/session', () => ({
      getSessionForSite,
    }));

    jest.doMock('@/platform/ssr', () => ({
      __esModule: true,
      default: {
        get: jest.fn((id: string) => services.get(id)),
      },
    }));

    const [{ getCachedNavigationCategoryTrees }, { default: BatteryIncludedSearchService }] = await Promise.all([
      import('./navigation-category-trees'),
      import('@/platform/services/search/impl/BatteryIncludedSearchService'),
    ]);

    return {
      getCachedNavigationCategoryTrees,
      BatteryIncludedSearchService,
      services,
      getSessionForSite,
    };
  }

  it('uses the BI tree service when the active SearchService binding is BatteryIncluded', async () => {
    const { getCachedNavigationCategoryTrees, BatteryIncludedSearchService, services, getSessionForSite } =
      await loadModule();
    const roots = [{ id: 'bi-root', name: { en: 'BI Root' }, children: [] }];
    const categoryService = {
      getNavigationCategoryTrees: jest.fn(),
    };
    const batteryIncludedCategoryTreeService = {
      getSnapshot: jest.fn().mockResolvedValue({
        roots,
        byId: {},
        byFacetValue: {},
        countsById: {},
      }),
    };

    getSessionForSite.mockResolvedValue({ country: 'DE' });
    services.set('CategoryService', categoryService);
    services.set('BatteryIncludedCategoryTreeService', batteryIncludedCategoryTreeService);
    services.set(
      'SearchService',
      new BatteryIncludedSearchService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    );

    await expect(getCachedNavigationCategoryTrees('main', 'en')).resolves.toEqual(roots);

    expect(getSessionForSite).toHaveBeenCalledWith('main');
    expect(batteryIncludedCategoryTreeService.getSnapshot).toHaveBeenCalledWith({
      siteCode: 'main',
      locale: 'en',
      country: 'DE',
      showUnpublished: false,
    });
    expect(categoryService.getNavigationCategoryTrees).not.toHaveBeenCalled();
  });

  it('falls back to the Emporix category tree when the BI snapshot is unavailable', async () => {
    const { getCachedNavigationCategoryTrees, BatteryIncludedSearchService, services, getSessionForSite } =
      await loadModule();
    const emporixRoots = [{ id: 'emporix-root', name: { en: 'Emporix Root' }, children: [] }];
    const categoryService = {
      getNavigationCategoryTrees: jest.fn().mockResolvedValue(emporixRoots),
    };
    const batteryIncludedCategoryTreeService = {
      getSnapshot: jest.fn().mockResolvedValue(null),
    };

    getSessionForSite.mockResolvedValue(undefined);
    services.set('CategoryService', categoryService);
    services.set('BatteryIncludedCategoryTreeService', batteryIncludedCategoryTreeService);
    services.set(
      'SearchService',
      new BatteryIncludedSearchService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    );

    await expect(getCachedNavigationCategoryTrees('main', 'en')).resolves.toEqual(emporixRoots);

    expect(batteryIncludedCategoryTreeService.getSnapshot).toHaveBeenCalledWith({
      siteCode: 'main',
      locale: 'en',
      country: undefined,
      showUnpublished: false,
    });
    expect(categoryService.getNavigationCategoryTrees).toHaveBeenCalledWith('main', false);
  });

  it('keeps the Emporix path unchanged when the active SearchService binding is not BatteryIncluded', async () => {
    const { getCachedNavigationCategoryTrees, services, getSessionForSite } = await loadModule();
    const emporixRoots = [{ id: 'emporix-root', name: { en: 'Emporix Root' }, children: [] }];
    const categoryService = {
      getNavigationCategoryTrees: jest.fn().mockResolvedValue(emporixRoots),
    };
    const batteryIncludedCategoryTreeService = {
      getSnapshot: jest.fn(),
    };

    services.set('SearchService', { searchProducts: jest.fn() });
    services.set('CategoryService', categoryService);
    services.set('BatteryIncludedCategoryTreeService', batteryIncludedCategoryTreeService);

    await expect(getCachedNavigationCategoryTrees('main', 'en', true)).resolves.toEqual(emporixRoots);

    expect(getSessionForSite).not.toHaveBeenCalled();
    expect(batteryIncludedCategoryTreeService.getSnapshot).not.toHaveBeenCalled();
    expect(categoryService.getNavigationCategoryTrees).toHaveBeenCalledWith('main', true);
  });
});
