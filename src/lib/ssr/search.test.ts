describe('getSearchResultsLayout', () => {
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

    const [{ getSearchResultsLayout }, { default: BatteryIncludedSearchService }] = await Promise.all([
      import('./search'),
      import('@/platform/services/search/impl/BatteryIncludedSearchService'),
    ]);

    return {
      getSearchResultsLayout,
      BatteryIncludedSearchService,
      services,
    };
  }

  it('returns list when the active SearchService binding is BatteryIncluded', async () => {
    const { getSearchResultsLayout, BatteryIncludedSearchService, services } = await loadModule();

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

    expect(getSearchResultsLayout()).toBe('list');
  });

  it('returns grid when the active SearchService binding is not BatteryIncluded', async () => {
    const { getSearchResultsLayout, services } = await loadModule();

    services.set('SearchService', { searchProducts: jest.fn() });

    expect(getSearchResultsLayout()).toBe('grid');
  });
});
