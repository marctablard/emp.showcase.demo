import BatteryIncludedSearchService from './BatteryIncludedSearchService';
import { BATTERY_INCLUDED_DEFAULT_SORTS } from './BatteryIncludedSortResolver';

describe('BatteryIncludedSearchService', () => {
  it('requests BI variant hits and enriches parent products with response-derived variant counts', async () => {
    const parentHit = {
      document: {
        id: 'parent-1',
        _product: {
          id: 'parent-1',
          productType: 'PARENT_VARIANT',
        },
      },
    };
    const childHitA = {
      document: {
        id: 'child-1',
        _product: {
          id: 'child-1',
          productType: 'VARIANT',
          parentVariantId: 'parent-1',
        },
      },
    };
    const childHitB = {
      document: {
        id: 'child-2',
        _product: {
          id: 'child-2',
          productType: 'VARIANT',
          parentVariantId: 'parent-1',
        },
      },
    };
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [parentHit, childHitA, childHitB],
        found: 3,
        page: 1,
        size: 12,
        facet_counts: [],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const productMapper = {
      mapToService: jest.fn().mockImplementation((product) => ({
        id: product._product.id,
        isParentVariant: product._product.productType === 'PARENT_VARIANT',
        purchasable: product._product.productType !== 'PARENT_VARIANT',
      })),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      productMapper as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    const result = await service.searchProducts({ page: 0, size: 12 }, 'en', 'main');

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        variants: 0,
        visibility: expect.objectContaining({
          filters: expect.objectContaining({
            '_product.published': 'true',
            '_product.categoryIds': ['root-a'],
          }),
        }),
      }),
    );
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({
      id: 'parent-1',
      isParentVariant: true,
      variantCount: 2,
    });
    expect(result.items[1]).toMatchObject({ id: 'child-1' });
    expect(result.items[2]).toMatchObject({ id: 'child-2' });
    expect(productMapper.mapToService).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        __batteryIncludedSelection: {
          siteAware: 'main',
          currencyAware: 'EUR',
        },
      }),
    );
  });

  it('forwards caller-provided visibility variables to highlights and recommendations', async () => {
    const shopApi = {
      browse: jest.fn(),
      suggest: jest.fn(),
      getHighlights: jest.fn().mockResolvedValue([]),
      getRecommendations: jest.fn().mockResolvedValue([]),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn() } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    const explicitVisibility = {
      locale: 'fr',
      siteAware: 'preview',
      countryAware: 'CA',
      currencyAware: 'CAD',
    };

    await service.getHighlights(explicitVisibility);
    await service.getRecommendations('product-1', 'en', 'main', 5, explicitVisibility);

    expect(shopApi.getHighlights).toHaveBeenCalledWith({
      variables: explicitVisibility,
      filters: {
        '_product.published': 'true',
        '_product.categoryIds': ['root-a'],
      },
    });
    expect(shopApi.getRecommendations).toHaveBeenCalledWith('product-1', {
      variables: explicitVisibility,
      filters: {
        '_product.published': 'true',
        '_product.categoryIds': ['root-a'],
      },
    });
  });

  it('translates legacy categoryIds to the BI breadcrumb facet and suppresses the raw facet from available filters', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [
          {
            field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
            type: 'select',
            stats: { total_values: 1 },
            counts: [
              {
                count: 1,
                value: 'Cables > USB-C',
                data: {
                  displayPath: 'Cables > USB-C',
                  idPath: 'root-a > child-a',
                },
              },
            ],
          },
          {
            field_name: 'color',
            type: 'select',
            stats: { total_values: 1 },
            counts: [{ count: 1, value: 'red' }],
          },
        ],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const productMapper = {
      mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }),
    };
    const sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }),
    };
    const segmentFilterService = {
      getSegmentIds: jest.fn().mockResolvedValue([]),
    };
    const siteService = {
      getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }),
    };
    const customerService = {
      getCustomer: jest.fn().mockResolvedValue(null),
    };
    const categoryTreeService = {
      getSnapshot: jest.fn().mockResolvedValue({
        roots: [],
        byId: {
          'child-a': {
            id: 'child-a',
            displayPath: 'Cables > USB-C',
            facetValue: 'Cables > USB-C',
            labelPath: 'Cables > USB-C',
            leafLabel: 'USB-C',
            publicationAnchorId: 'root-a',
            count: 1,
            idPath: ['root-a', 'child-a'],
          },
        },
        byFacetValue: {},
        countsById: { 'child-a': 1 },
      }),
    };
    const logger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      productMapper as never,
      sessionService as never,
      segmentFilterService as never,
      customerService as never,
      categoryTreeService as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      siteService as never,
      logger as never,
    );

    const result = await service.searchProducts(
      {
        page: 0,
        size: 12,
        filters: {
          categoryIds: 'child-a',
          color: ['red'],
        },
      },
      'en',
      'main',
    );

    expect(categoryTreeService.getSnapshot).toHaveBeenCalledWith({
      siteCode: 'main',
      locale: 'en',
      country: 'DE',
      showUnpublished: false,
    });
    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: expect.objectContaining({
          filters: expect.objectContaining({
            color: ['red'],
            '_product_i18n.categoryBreadcrumbs.displayPath': 'Cables > USB-C',
            '_product.published': 'true',
            '_product.categoryIds': ['root-a'],
          }),
        }),
      }),
    );
    expect(shopApi.browse.mock.calls[0][0].filters).toBeUndefined();
    expect(result.availableFilters).toHaveLength(1);
    expect(result.availableFilters[0]).toMatchObject({
      id: 'color',
      values: [{ id: 'red', active: true }],
    });
  });

  it('passes explicit visibility variables into suggest requests', async () => {
    const shopApi = {
      browse: jest.fn(),
      suggest: jest.fn().mockResolvedValue([]),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn() } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.getSuggestions({ query: 'pho', locale: 'en', site: 'main', currency: 'EUR' });

    expect(shopApi.suggest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'pho',
      }),
    );
  });

  it('exposes the guaranteed BI default sorts and dedupes explicit response-driven sort facets', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [
          {
            field_name:
              '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount',
            field_label: 'Net price',
            type: 'select',
            stats: { total_values: 2 },
            counts: [
              { count: 0, value: 'price:asc' },
              { count: 0, value: 'price:desc' },
            ],
          },
          {
            field_name: '_product_i18n.{locale}.brand.name',
            field_label: 'Brand',
            type: 'select',
            stats: { total_values: 1 },
            counts: [
              {
                count: 1,
                value: 'Acme',
              },
            ],
          },
          {
            field_name:
              '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount',
            field_label: 'Net price',
            type: 'range',
            stats: { min: 10, max: 20 },
          },
          {
            field_name: 'rating',
            type: 'select',
            stats: { total_values: 2 },
            counts: [
              { count: 6, value: '4' },
              { count: 3, value: '5' },
            ],
          },
          {
            field_name: 'brandTree',
            type: 'select',
            stats: { total_values: 1 },
            counts: [
              {
                count: 3,
                value: 'Power Tools > Drills',
                data: {
                  displayPath: 'Power Tools > Drills',
                  idPath: 'power-tools > drills',
                },
              },
            ],
          },
          {
            field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
            field_label: 'Breadcrumb',
            type: 'select',
            stats: { total_values: 1 },
            counts: [
              {
                count: 1,
                value: 'Cables > USB-C',
                data: {
                  displayPath: 'Cables > USB-C',
                  idPath: 'root-a > child-a',
                },
              },
            ],
          },
          {
            field_name: 'segmentIds',
            field_label: 'Segments',
            type: 'select',
            stats: { total_values: 1 },
            counts: [{ count: 1, value: 'vip' }],
          },
        ],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    const result = await service.searchProducts(
      {
        page: 0,
        size: 12,
        sort: '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount:asc',
        filters: {
          color: ['red'],
          brandTree: 'Power Tools > Drills',
          price: { from: '10', till: '20' },
          rating: '4',
          customerRating: '4',
        },
      },
      'en',
      'main',
    );

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        analyze: 1,
        sort: '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount:asc',
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
            countryAware: 'DE',
            currencyAware: 'EUR',
          },
        }),
      }),
    );

    expect(result.availableSorts).toEqual(BATTERY_INCLUDED_DEFAULT_SORTS);

    expect(result.batteryIncludedFacets).toEqual([
      {
        id: '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount',
        label: 'Net price',
        kind: 'select',
        options: [
          { id: 'price:asc', label: 'price:asc', active: false, count: 0 },
          { id: 'price:desc', label: 'price:desc', active: false, count: 0 },
        ],
      },
      {
        id: '_product_i18n.{locale}.brand.name',
        label: 'Brand',
        kind: 'select',
        options: [{ id: 'Acme', label: 'Acme', active: false, count: 1 }],
      },
      {
        id: '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount',
        label: 'Net price',
        kind: 'range',
        min: '10',
        max: '20',
      },
      {
        id: 'rating',
        label: 'rating',
        kind: 'rating',
        options: [
          { id: '4', label: '4 stars & up', active: true, count: 6 },
          { id: '5', label: '5 stars & up', active: false, count: 3 },
        ],
      },
      {
        id: 'brandTree',
        label: 'brandTree',
        kind: 'tree',
        options: [
          {
            id: 'Power Tools > Drills',
            label: 'Power Tools > Drills',
            active: true,
            count: 3,
            idPath: ['power-tools', 'drills'],
            labelPath: ['Power Tools', 'Drills'],
          },
        ],
      },
      {
        id: '_product_i18n.categoryBreadcrumbs.displayPath',
        label: 'Breadcrumb',
        kind: 'tree',
        options: [
          {
            id: 'Cables > USB-C',
            label: 'Cables > USB-C',
            active: false,
            count: 1,
            idPath: ['root-a', 'child-a'],
            labelPath: ['Cables', 'USB-C'],
          },
        ],
      },
    ]);
  });

  it('returns the default BI sorts when BI only exposes ineligible facets', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [
          {
            field_name: 'segmentIds',
            field_label: 'Segments',
            type: 'select',
            stats: { total_values: 1 },
            counts: [{ count: 1, value: 'vip' }],
          },
          {
            field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
            field_label: 'Breadcrumb',
            type: 'select',
            stats: { total_values: 1 },
            counts: [
              {
                count: 1,
                value: 'Cables > USB-C',
                data: {
                  displayPath: 'Cables > USB-C',
                  idPath: 'root-a > child-a',
                },
              },
            ],
          },
          {
            field_name: 'brandTree',
            type: 'select',
            stats: { total_values: 1 },
            counts: [
              {
                count: 3,
                value: 'Power Tools > Drills',
                data: {
                  displayPath: 'Power Tools > Drills',
                  idPath: 'power-tools > drills',
                },
              },
            ],
          },
        ],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    const result = await service.searchProducts(
      {
        page: 0,
        size: 12,
      },
      'en',
      'main',
    );

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: undefined,
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
            countryAware: 'DE',
            currencyAware: 'EUR',
          },
        }),
      }),
    );
    expect(result.availableSorts).toEqual(BATTERY_INCLUDED_DEFAULT_SORTS);
    expect(result.batteryIncludedFacets).toEqual([
      {
        id: '_product_i18n.categoryBreadcrumbs.displayPath',
        label: 'Breadcrumb',
        kind: 'tree',
        options: [
          {
            id: 'Cables > USB-C',
            label: 'Cables > USB-C',
            active: false,
            count: 1,
            idPath: ['root-a', 'child-a'],
            labelPath: ['Cables', 'USB-C'],
          },
        ],
      },
      {
        id: 'brandTree',
        label: 'brandTree',
        kind: 'tree',
        options: [
          {
            id: 'Power Tools > Drills',
            label: 'Power Tools > Drills',
            active: false,
            count: 3,
            idPath: ['power-tools', 'drills'],
            labelPath: ['Power Tools', 'Drills'],
          },
        ],
      },
    ]);
  });

  it('forwards the guaranteed BI price default sort upstream on the next browse request', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [
          {
            field_name:
              '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount',
            field_label: 'Net price',
            type: 'select',
            stats: { total_values: 2 },
            counts: [
              { count: 0, value: 'price:asc' },
              { count: 0, value: 'price:desc' },
            ],
          },
        ],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.searchProducts(
      {
        page: 0,
        size: 12,
        sort: '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount:asc',
      },
      'en',
      'main',
    );

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount:asc',
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
            countryAware: 'DE',
            currencyAware: 'EUR',
          },
        }),
      }),
    );
  });

  it('forwards the guaranteed BI name default sort upstream on the next browse request', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'US' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.searchProducts(
      {
        page: 0,
        size: 12,
        sort: '_product_i18n.{locale}.name:asc',
      },
      'en',
      'main',
    );

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: '_product_i18n.{locale}.name:asc',
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
            countryAware: 'DE',
            currencyAware: 'EUR',
          },
        }),
      }),
    );
  });

  it('returns the default BI sorts when BI returns no sort facets', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'US', currency: 'USD' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'US' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    const result = await service.searchProducts({ page: 0, size: 12 }, 'en', 'main');

    expect(result.availableSorts).toEqual(BATTERY_INCLUDED_DEFAULT_SORTS);
    expect(result.batteryIncludedFacets).toEqual([]);
  });

  it('maps stats-only BI range facets without crashing and preserves min/max in typed and legacy filters', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [
          {
            field_name: '_product_siteAware.currencyAware.countryAware.prices.effectiveAmount',
            field_label: 'Netto Price DE',
            field_unit: '',
            type: 'range',
            stats: { min: 21, max: 69 },
          },
        ],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    const result = await service.searchProducts({ page: 0, size: 12 }, 'en', 'main');

    expect(result.batteryIncludedFacets).toEqual([
      {
        id: '_product_siteAware.currencyAware.countryAware.prices.effectiveAmount',
        label: 'Netto Price DE',
        kind: 'range',
        min: '21',
        max: '69',
      },
    ]);
    expect(result.availableFilters).toEqual([
      {
        id: '_product_siteAware.currencyAware.countryAware.prices.effectiveAmount',
        name: 'Netto Price DE',
        labelIsPlainText: true,
        values: [
          { id: '21', name: '21', active: false },
          { id: '69', name: '69', active: false },
        ],
      },
    ]);
  });

  it('does not crash on browse-like mixed select, tree, and stats-only range facets', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [{ document: { id: 'product-1' } }],
        found: 1,
        page: 1,
        size: 12,
        facet_counts: [
          {
            field_name: 'brand',
            field_label: 'Brand',
            type: 'select',
            stats: { total_values: 2 },
            counts: [
              { count: 1, value: 'EcoFlow' },
              { count: 2, value: 'Victron Energy' },
            ],
          },
          {
            field_name: 'categoryTree',
            type: 'select',
            stats: { total_values: 1 },
            counts: [
              {
                count: 3,
                value: 'Electrical supplies > Power generation',
                data: {
                  displayPath: 'Electrical supplies > Power generation',
                  idPath: 'electrical-supplies > power-generation',
                },
              },
            ],
          },
          {
            field_name: '_product_siteAware.currencyAware.countryAware.prices.effectiveAmount',
            field_label: 'Netto Price DE',
            type: 'range',
            stats: { min: 21, max: 69 },
          },
        ],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    const result = await service.searchProducts({ page: 0, size: 12 }, 'en', 'main');

    expect(result.batteryIncludedFacets).toEqual([
      {
        id: 'brand',
        label: 'Brand',
        kind: 'select',
        options: [
          { id: 'EcoFlow', label: 'EcoFlow', active: false, count: 1 },
          { id: 'Victron Energy', label: 'Victron Energy', active: false, count: 2 },
        ],
      },
      {
        id: 'categoryTree',
        label: 'categoryTree',
        kind: 'tree',
        options: [
          {
            id: 'Electrical supplies > Power generation',
            label: 'Electrical supplies > Power generation',
            active: false,
            count: 3,
            labelPath: ['Electrical supplies', 'Power generation'],
            idPath: ['electrical-supplies', 'power-generation'],
          },
        ],
      },
      {
        id: '_product_siteAware.currencyAware.countryAware.prices.effectiveAmount',
        label: 'Netto Price DE',
        kind: 'range',
        min: '21',
        max: '69',
      },
    ]);
    expect(result.availableFilters).toEqual([
      {
        id: 'brand',
        name: 'Brand',
        labelIsPlainText: true,
        values: [
          { id: 'EcoFlow', name: 'EcoFlow', active: false, count: 1 },
          { id: 'Victron Energy', name: 'Victron Energy', active: false, count: 2 },
        ],
      },
      {
        id: 'categoryTree',
        name: 'categoryTree',
        labelIsPlainText: true,
        values: [
          {
            id: 'Electrical supplies > Power generation',
            name: 'Electrical supplies > Power generation',
            active: false,
            count: 3,
          },
        ],
      },
      {
        id: '_product_siteAware.currencyAware.countryAware.prices.effectiveAmount',
        name: 'Netto Price DE',
        labelIsPlainText: true,
        values: [
          { id: '21', name: '21', active: false },
          { id: '69', name: '69', active: false },
        ],
      },
    ]);
  });

  it('keeps categoryIds when the BI snapshot is unavailable', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [],
        found: 0,
        page: 1,
        size: 12,
        facet_counts: [],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE' }),
    };
    const categoryTreeService = {
      getSnapshot: jest.fn().mockResolvedValue(null),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn() } as never,
      sessionService as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      categoryTreeService as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.searchProducts(
      {
        page: 0,
        size: 12,
        filters: {
          categoryIds: 'child-a',
        },
      },
      'en',
      'main',
    );

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
            countryAware: 'DE',
          },
          filters: expect.objectContaining({
            categoryIds: 'child-a',
            '_product.published': 'true',
            '_product.categoryIds': ['root-a'],
          }),
        }),
      }),
    );
  });

  it('includes selected country and currency in BI browse variables when present', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [],
        found: 0,
        page: 1,
        size: 12,
        facet_counts: [],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', currency: 'EUR' }),
    };
    const siteService = {
      getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn() } as never,
      sessionService as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      siteService as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.searchProducts(
      {
        page: 0,
        size: 12,
      },
      'en',
      'main',
    );

    expect(siteService.getSite).toHaveBeenCalledWith('main');
    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
            countryAware: 'DE',
            currencyAware: 'EUR',
          },
          filters: {
            '_product.published': 'true',
            '_product.categoryIds': ['root-a'],
          },
        }),
      }),
    );
  });

  it('keeps categoryIds when a BI node has no facet mapping', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [],
        found: 0,
        page: 1,
        size: 12,
        facet_counts: [],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE' }),
    };
    const categoryTreeService = {
      getSnapshot: jest.fn().mockResolvedValue({
        roots: [],
        byId: {
          'child-a': {
            id: 'child-a',
            labelPath: 'Cables > USB-C',
            leafLabel: 'USB-C',
            publicationAnchorId: 'root-a',
            count: 1,
            idPath: ['root-a', 'child-a'],
          },
        },
        byFacetValue: {},
        countsById: { 'child-a': 1 },
      }),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn() } as never,
      sessionService as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      categoryTreeService as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.searchProducts(
      {
        page: 0,
        size: 12,
        filters: {
          categoryIds: 'child-a',
        },
      },
      'en',
      'main',
    );

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
            countryAware: 'DE',
          },
          filters: expect.objectContaining({
            categoryIds: 'child-a',
            '_product.published': 'true',
            '_product.categoryIds': ['root-a'],
          }),
        }),
      }),
    );
  });

  it('omits countryAware when the session has no country', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [],
        found: 0,
        page: 1,
        size: 12,
        facet_counts: [],
      }),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: null }),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      { mapToService: jest.fn() } as never,
      sessionService as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: null }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.searchProducts(
      {
        page: 0,
        size: 12,
      },
      'en',
      'main',
    );

    expect(shopApi.browse).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: expect.objectContaining({
          variables: {
            locale: 'en',
            siteAware: 'main',
          },
          filters: {
            '_product.published': 'true',
            '_product.categoryIds': ['root-a'],
          },
        }),
      }),
    );
  });

  it('passes BI suggest variables and preserves selection context for highlighted suggestion products', async () => {
    const apiResponse = [
      {
        kind: 'document',
        hits: [
          {
            highlighted: {
              id: 'suggested-product',
              _product: {
                id: 'suggested-product',
                code: 'suggested-product',
                productType: 'PARENT_VARIANT',
              },
              _product_i18n: {
                name: 'Suggested Product',
              },
              _product_siteAware: {
                main: {
                  currencyAware: {
                    EUR: {
                      countryAware: {
                        DE: {
                          prices: [
                            {
                              currency: 'EUR',
                              effectiveAmount: 60,
                              originalAmount: 75,
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ];
    const shopApi = {
      browse: jest.fn(),
      suggest: jest.fn().mockResolvedValue(apiResponse),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const productMapper = {
      mapToService: jest.fn(),
      mapSearchSuggestions: jest.fn().mockReturnValue({
        queryCompletions: [],
        products: [],
        categories: [],
      }),
    };
    const sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      productMapper as never,
      sessionService as never,
      { getSegmentIds: jest.fn().mockResolvedValue([]) } as never,
      { getCustomer: jest.fn().mockResolvedValue(null) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.getSuggestions({ query: 'pho', locale: 'en' });

    expect(shopApi.suggest).toHaveBeenCalledWith({
      query: 'pho',
      visibility: {
        variables: {
          locale: 'en',
          siteAware: 'main',
          countryAware: 'DE',
          currencyAware: 'EUR',
        },
        filters: {
          '_product.published': 'true',
          '_product.categoryIds': ['root-a'],
        },
      },
    });
    expect(productMapper.mapSearchSuggestions).toHaveBeenCalledWith([
      {
        kind: 'document',
        hits: [
          {
            highlighted: expect.objectContaining({
              __batteryIncludedSelection: {
                siteAware: 'main',
                currencyAware: 'EUR',
              },
            }),
          },
        ],
      },
    ]);
  });

  it('passes multi-segment customer filters to BI suggest as repeated segment ids', async () => {
    const shopApi = {
      browse: jest.fn(),
      suggest: jest.fn().mockResolvedValue([]),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const productMapper = {
      mapToService: jest.fn(),
      mapSearchSuggestions: jest.fn().mockReturnValue({
        queryCompletions: [],
        products: [],
        categories: [],
      }),
    };
    const sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }),
    };
    const segmentFilterService = {
      getSegmentIds: jest.fn().mockResolvedValue(['seg-a', 'seg-b']),
    };
    const customerService = {
      getCustomer: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      productMapper as never,
      sessionService as never,
      segmentFilterService as never,
      customerService as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(['root-a']) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await service.getSuggestions({ query: 'pho', locale: 'en', customerSegments: true });

    expect(segmentFilterService.getSegmentIds).toHaveBeenCalled();
    expect(shopApi.suggest).toHaveBeenCalledWith({
      query: 'pho',
      visibility: {
        variables: {
          locale: 'en',
          siteAware: 'main',
          countryAware: 'DE',
          currencyAware: 'EUR',
        },
        filters: {
          '_product.published': 'true',
          '_product.categoryIds': ['root-a'],
        },
      },
      segmentIds: ['seg-a', 'seg-b'],
    });
  });

  it('fails closed for every BI path when the site has no published roots', async () => {
    const shopApi = {
      browse: jest.fn(),
      suggest: jest.fn(),
      getHighlights: jest.fn(),
      getRecommendations: jest.fn(),
      getPresets: jest.fn(),
    };
    const productMapper = {
      mapToService: jest.fn(),
      mapSearchSuggestions: jest.fn(),
    };

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      productMapper as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { getSegmentIds: jest.fn().mockResolvedValue(['seg-a']) } as never,
      { getCustomer: jest.fn().mockResolvedValue({ id: 'customer-1' }) } as never,
      { getSnapshot: jest.fn() } as never,
      { getRootCategoryIdsForSite: jest.fn().mockResolvedValue([]) } as never,
      { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
      {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as never,
    );

    await expect(service.searchProducts({ page: 0, size: 12 }, 'en', 'main')).resolves.toEqual({
      items: [],
      page: 0,
      pageSize: 12,
      total: 0,
      availableFilters: [],
      availableSorts: [],
      batteryIncludedFacets: [],
    });

    await expect(service.getSuggestions({ query: 'pho', locale: 'en', site: 'main' })).resolves.toEqual({
      queryCompletions: [],
      products: [],
      categories: [],
    });

    await expect(service.getHighlights({ locale: 'en', siteAware: 'main' })).resolves.toEqual([]);
    await expect(
      service.getRecommendations('product-1', 'en', 'main', 5, { locale: 'en', siteAware: 'main' }),
    ).resolves.toEqual([]);

    expect(shopApi.browse).not.toHaveBeenCalled();
    expect(shopApi.suggest).not.toHaveBeenCalled();
    expect(shopApi.getHighlights).not.toHaveBeenCalled();
    expect(shopApi.getRecommendations).not.toHaveBeenCalled();
  });
});
