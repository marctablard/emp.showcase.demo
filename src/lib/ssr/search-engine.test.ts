async function loadModule() {
  jest.resetModules();

  const services = new Map<string, unknown>();

  jest.doMock('@/platform/ssr', () => ({
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
    },
  }));

  const [{ getActiveSearchEngine }, { default: BatteryIncludedSearchService }] = await Promise.all([
    import('./search-engine'),
    import('@/platform/services/search/impl/BatteryIncludedSearchService'),
  ]);

  return {
    getActiveSearchEngine,
    BatteryIncludedSearchService,
    services,
  };
}

describe('getActiveSearchEngine', () => {
  it('returns batteryincluded when SearchService binding is BatteryIncluded', async () => {
    const { getActiveSearchEngine, BatteryIncludedSearchService, services } = await loadModule();

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

    expect(getActiveSearchEngine()).toBe('batteryincluded');
  });

  it('returns emporix when SearchService binding is not BatteryIncluded', async () => {
    const { getActiveSearchEngine, services } = await loadModule();

    services.set('SearchService', { searchProducts: jest.fn() });

    expect(getActiveSearchEngine()).toBe('emporix');
  });
});
