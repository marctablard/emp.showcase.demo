import BatteryIncludedCategoryTreeService from './BatteryIncludedCategoryTreeService';

describe('BatteryIncludedCategoryTreeService', () => {
  const shopApi = {
    browseCategoryTreeBootstrap: jest.fn(),
  };
  const catalogPublishedRootCategoryService = {
    getRootCategoryIdsForSite: jest.fn(),
  };
  const categoryService = {
    getCategoriesByIds: jest.fn(),
  };
  const logger = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  const service = new BatteryIncludedCategoryTreeService(
    shopApi as never,
    catalogPublishedRootCategoryService as never,
    categoryService as never,
    logger as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    (service as any).cache.clear();
  });

  it('enriches snapshotted categories with descriptions from a single bulk call', async () => {
    catalogPublishedRootCategoryService.getRootCategoryIdsForSite.mockResolvedValue(['root1']);
    shopApi.browseCategoryTreeBootstrap.mockResolvedValue({
      hits: [],
      found: 0,
      page: 0,
      size: 0,
      facet_counts: [
        {
          field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
          type: 'select',
          stats: { total_values: 2 },
          counts: [
            {
              count: 10,
              value: 'Root 1',
              data: {
                displayPath: 'Root 1',
                idPath: 'root1',
              },
            },
            {
              count: 5,
              value: 'Root 1 > Child 1',
              data: {
                displayPath: 'Root 1 > Child 1',
                idPath: 'root1 > child1',
              },
            },
          ],
        },
      ],
    });

    categoryService.getCategoriesByIds.mockResolvedValue([
      { id: 'root1', description: 'Enriched Root Description' },
      { id: 'child1', description: 'Enriched Child Description' },
    ]);

    const snapshot = await service.getSnapshot({
      siteCode: 'TEST',
      locale: 'en',
      country: 'none',
      showUnpublished: false,
    });

    expect(snapshot).toBeDefined();
    expect(categoryService.getCategoriesByIds).toHaveBeenCalledTimes(1);
    expect(categoryService.getCategoriesByIds).toHaveBeenCalledWith(['root1', 'child1'], {
      showRoots: false,
      showUnpublished: false,
    });
    expect(shopApi.browseCategoryTreeBootstrap).toHaveBeenCalledWith({
      locale: 'en',
      siteCode: 'TEST',
      country: 'none',
      variables: {
        locale: 'en',
        siteAware: 'TEST',
        countryAware: 'none',
      },
      visibility: {
        variables: {
          locale: 'en',
          siteAware: 'TEST',
          countryAware: 'none',
        },
        filters: {
          '_product.published': 'true',
          '_product.categoryIds': ['root1'],
        },
      },
    });

    const root = snapshot!.roots[0] as {
      description?: unknown;
      children?: Array<{ id: string; description?: unknown }>;
    };
    expect(root.description).toBe('Enriched Root Description');
    expect(root.children?.[0]?.description).toBe('Enriched Child Description');
    expect(snapshot!.roots.length).toBe(1);
  });

  it('covers partial enrichment or missing category details without breaking tree-shape output for BI roots', async () => {
    catalogPublishedRootCategoryService.getRootCategoryIdsForSite.mockResolvedValue(['root1']);
    shopApi.browseCategoryTreeBootstrap.mockResolvedValue({
      hits: [],
      found: 0,
      page: 0,
      size: 0,
      facet_counts: [
        {
          field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
          type: 'select',
          stats: { total_values: 2 },
          counts: [
            {
              count: 10,
              value: 'Root 1',
              data: {
                displayPath: 'Root 1',
                idPath: 'root1',
              },
            },
            {
              count: 5,
              value: 'Root 1 > Child 1',
              data: {
                displayPath: 'Root 1 > Child 1',
                idPath: 'root1 > child1',
              },
            },
          ],
        },
      ],
    });

    categoryService.getCategoriesByIds.mockResolvedValue([{ id: 'root1', description: 'Enriched Root Description' }]);

    const snapshot = await service.getSnapshot({
      siteCode: 'TEST',
      locale: 'en',
      country: 'none',
      showUnpublished: false,
    });
    const root = snapshot!.roots[0] as {
      description?: unknown;
      children?: Array<{ id: string; description?: unknown }>;
    };
    expect(root.description).toBe('Enriched Root Description');
    expect(root.children?.[0]?.description).toBeUndefined();
    expect(root.children?.[0]?.id).toBe('child1');
  });

  it('separates cached snapshots by showUnpublished flag', async () => {
    catalogPublishedRootCategoryService.getRootCategoryIdsForSite.mockResolvedValue(['root1']);
    shopApi.browseCategoryTreeBootstrap.mockResolvedValue({
      hits: [],
      found: 0,
      page: 0,
      size: 0,
      facet_counts: [
        {
          field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
          type: 'select',
          stats: { total_values: 1 },
          counts: [
            {
              count: 10,
              value: 'Root 1',
              data: {
                displayPath: 'Root 1',
                idPath: 'root1',
              },
            },
          ],
        },
      ],
    });
    categoryService.getCategoriesByIds.mockResolvedValue([]);

    await service.getSnapshot({ siteCode: 'TEST', locale: 'en', country: 'none', showUnpublished: false });
    await service.getSnapshot({ siteCode: 'TEST', locale: 'en', country: 'none', showUnpublished: true });

    expect(shopApi.browseCategoryTreeBootstrap).toHaveBeenCalledTimes(2);
  });

  it('short-circuits bootstrap when no published roots exist', async () => {
    catalogPublishedRootCategoryService.getRootCategoryIdsForSite.mockResolvedValue([]);

    const snapshot = await service.getSnapshot({
      siteCode: 'TEST',
      locale: 'en',
      country: 'none',
      showUnpublished: false,
    });

    expect(snapshot).toBeNull();
    expect(shopApi.browseCategoryTreeBootstrap).not.toHaveBeenCalled();
  });
});
