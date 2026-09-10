import BatteryIncludedSearchService from './BatteryIncludedSearchService';
import { BATTERY_INCLUDED_DEFAULT_SORTS } from './BatteryIncludedSortResolver';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string) => (key === 'bi.basePrice' ? 'Base Price' : key)),
}));

describe('BatteryIncludedSearchService', () => {
  it('resolves #-prefixed facet labels via translations and leaves plain labels verbatim', async () => {
    const shopApi = {
      browse: jest.fn().mockResolvedValue({
        hits: [],
        found: 0,
        page: 1,
        size: 12,
        facet_counts: [
          {
            field_name: '_product_siteAware.currencyAware.countryAware.price.effectiveAmount',
            field_label: '#bi.basePrice',
            type: 'range',
            stats: { min: 4, max: 5900 },
          },
          {
            field_name: '_product_i18n.brand.name',
            field_label: 'Brand',
            type: 'select',
            counts: [{ value: 'Victron', count: 1 }],
          },
          {
            field_name: '_product_i18n.unlabelled',
            type: 'select',
            counts: [{ value: 'X', count: 1 }],
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
      { mapToService: jest.fn() } as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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

    const rangeFacet = result.batteryIncludedFacets?.find((facet) => facet.kind === 'range');
    const brandFacet = result.batteryIncludedFacets?.find((facet) => facet.id === '_product_i18n.brand.name');
    const unlabelledFacet = result.batteryIncludedFacets?.find((facet) => facet.id === '_product_i18n.unlabelled');

    // `#bi.basePrice` is a localized-key marker -> resolved through translations.
    expect(rangeFacet?.label).toBe('Base Price');
    // Plain labels pass through verbatim.
    expect(brandFacet?.label).toBe('Brand');
    // Missing field_label falls back to field_name.
    expect(unlabelledFacet?.label).toBe('_product_i18n.unlabelled');
  });

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
        parentVariantId: product._product.parentVariantId,
        purchasable: product._product.productType !== 'PARENT_VARIANT',
      })),
    };

    const addAdditionalData = jest.fn(async (products: unknown) => products);
    const service = new BatteryIncludedSearchService(
      shopApi as never,
      productMapper as never,
      { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
      { addAdditionalData } as never,
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
    expect(result.items[0].variants).toEqual([
      expect.objectContaining({ id: 'child-1', parentVariantId: 'parent-1' }),
      expect.objectContaining({ id: 'child-2', parentVariantId: 'parent-1' }),
    ]);
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
    expect(addAdditionalData).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'parent-1' })]),
      { prices: false, variants: false, categories: false },
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
    const siteService = {
      getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }),
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
            field_name: '_product_siteAware.segmentIds',
            field_label: 'Segments IDs',
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
            field_name: '_product_siteAware.segmentIds',
            field_label: 'Segments IDs',
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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

  it('passes params.segmentIds to BI suggest as repeated segment ids', async () => {
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

    const service = new BatteryIncludedSearchService(
      shopApi as never,
      productMapper as never,
      sessionService as never,
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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

    await service.getSuggestions({ query: 'pho', locale: 'en', segmentIds: ['seg-a', 'seg-b'] });

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

  describe('segment scoping (COP-4822)', () => {
    function createSearchService(shopApi: Record<string, jest.Mock>) {
      return new BatteryIncludedSearchService(
        shopApi as never,
        { mapToService: jest.fn().mockReturnValue({ id: 'mapped-product-1' }) } as never,
        { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
        { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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
    }

    const emptyBrowse = { hits: [], found: 0, page: 1, size: 12, facet_counts: [] };

    it('passes params.segmentIds to BI browse as an array filter', async () => {
      const shopApi = {
        browse: jest.fn().mockResolvedValue(emptyBrowse),
        suggest: jest.fn(),
        getHighlights: jest.fn(),
        getRecommendations: jest.fn(),
        getPresets: jest.fn(),
      };
      const service = createSearchService(shopApi);

      await service.searchProducts(
        { page: 0, size: 12, filters: { color: ['red'] }, segmentIds: ['s1', 's2'] },
        'en',
        'main',
      );

      expect(shopApi.browse).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: expect.objectContaining({
            filters: {
              color: ['red'],
              '_product_siteAware.segmentIds': ['s1', 's2'],
              '_product.published': 'true',
              '_product.categoryIds': ['root-a'],
            },
          }),
        }),
      );
      // A top-level `segmentIds` filter is silently ignored by BI (COP-4822).
      expect(shopApi.browse.mock.calls[0][0].visibility.filters).not.toHaveProperty('segmentIds');
    });

    it('strips the BI segment facet from availableFilters and batteryIncludedFacets', async () => {
      const shopApi = {
        browse: jest.fn().mockResolvedValue({
          ...emptyBrowse,
          facet_counts: [
            {
              field_name: '_product_siteAware.segmentIds',
              field_label: 'Segments IDs',
              type: 'ignore',
              stats: { total_values: 1 },
              counts: [{ count: 9594, value: 'solarpanelfans' }],
            },
            {
              field_name: 'color',
              field_label: 'Color',
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
      const service = createSearchService(shopApi);

      const result = await service.searchProducts({ page: 0, size: 12, segmentIds: ['solarpanelfans'] }, 'en', 'main');

      expect(result.availableFilters.map((filter) => filter.id)).toEqual(['color']);
      expect(result.batteryIncludedFacets?.map((facet) => facet.id)).toEqual(['color']);
    });

    it('does not add a segmentIds filter when params.segmentIds is undefined', async () => {
      const shopApi = {
        browse: jest.fn().mockResolvedValue(emptyBrowse),
        suggest: jest.fn(),
        getHighlights: jest.fn(),
        getRecommendations: jest.fn(),
        getPresets: jest.fn(),
      };
      const service = createSearchService(shopApi);

      await service.searchProducts({ page: 0, size: 12, filters: { color: ['red'] } }, 'en', 'main');

      const browseFilters = shopApi.browse.mock.calls[0][0].visibility.filters;
      expect(browseFilters).not.toHaveProperty('_product_siteAware.segmentIds');
      expect(browseFilters).toEqual({
        color: ['red'],
        '_product.published': 'true',
        '_product.categoryIds': ['root-a'],
      });
    });

    it('returns an empty result without calling BI when params.segmentIds is [] (empty scope, fail closed)', async () => {
      const shopApi = {
        browse: jest.fn().mockResolvedValue(emptyBrowse),
        suggest: jest.fn(),
        getHighlights: jest.fn(),
        getRecommendations: jest.fn(),
        getPresets: jest.fn(),
      };
      const service = createSearchService(shopApi);

      const result = await service.searchProducts({ page: 0, size: 24, segmentIds: [] }, 'en', 'main');

      expect(shopApi.browse).not.toHaveBeenCalled();
      expect(result).toEqual({
        items: [],
        page: 0,
        pageSize: 24,
        total: 0,
        availableFilters: [],
        availableSorts: [],
        batteryIncludedFacets: [],
      });
    });

    it('returns empty suggestions without calling BI suggest when params.segmentIds is []', async () => {
      const shopApi = {
        browse: jest.fn(),
        suggest: jest.fn().mockResolvedValue([]),
        getHighlights: jest.fn(),
        getRecommendations: jest.fn(),
        getPresets: jest.fn(),
      };
      const service = createSearchService(shopApi);

      const result = await service.getSuggestions({ query: 'pho', locale: 'en', segmentIds: [] });

      expect(shopApi.suggest).not.toHaveBeenCalled();
      expect(result).toEqual({ queryCompletions: [], products: [], categories: [] });
    });

    it('does not forward segmentIds to BI suggest when params.segmentIds is undefined', async () => {
      const shopApi = {
        browse: jest.fn(),
        suggest: jest.fn().mockResolvedValue([]),
        getHighlights: jest.fn(),
        getRecommendations: jest.fn(),
        getPresets: jest.fn(),
      };
      const service = new BatteryIncludedSearchService(
        shopApi as never,
        { mapToService: jest.fn(), mapSearchSuggestions: jest.fn().mockReturnValue({}) } as never,
        { getCurrent: jest.fn().mockResolvedValue({ siteCode: 'main', country: 'DE', currency: 'EUR' }) } as never,
        { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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

      expect(shopApi.suggest.mock.calls[0][0]).not.toHaveProperty('segmentIds');
    });

    describe('getRecommendations', () => {
      const recommendationHits = [{ document: { id: 'rec-1' } }, { document: { id: 'rec-2' } }];

      it('returns [] without calling BI when segmentIds is an empty scope', async () => {
        const shopApi = {
          browse: jest.fn(),
          suggest: jest.fn(),
          getHighlights: jest.fn(),
          getRecommendations: jest.fn(),
          getPresets: jest.fn(),
        };
        const service = createSearchService(shopApi);

        await expect(
          service.getRecommendations('product-1', 'en', 'main', 12, undefined, { segmentIds: [] }),
        ).resolves.toEqual([]);

        expect(shopApi.getRecommendations).not.toHaveBeenCalled();
        expect(shopApi.browse).not.toHaveBeenCalled();
      });

      it('adds the segment filter to the BI recommendations visibility filters', async () => {
        const shopApi = {
          browse: jest.fn(),
          suggest: jest.fn(),
          getHighlights: jest.fn(),
          getRecommendations: jest.fn().mockResolvedValue(recommendationHits),
          getPresets: jest.fn(),
        };
        const service = createSearchService(shopApi);

        const result = await service.getRecommendations('product-1', 'en', 'main', 12, undefined, {
          segmentIds: ['s1', 's2'],
        });

        expect(shopApi.getRecommendations).toHaveBeenCalledTimes(1);
        expect(shopApi.getRecommendations).toHaveBeenCalledWith('product-1', {
          variables: expect.objectContaining({ siteAware: 'main' }),
          filters: {
            '_product.published': 'true',
            '_product.categoryIds': ['root-a'],
            '_product_siteAware.segmentIds': ['s1', 's2'],
          },
        });
        expect(result).toHaveLength(2);
      });

      it('does not add a segment filter when segmentIds is undefined', async () => {
        const shopApi = {
          browse: jest.fn(),
          suggest: jest.fn(),
          getHighlights: jest.fn(),
          getRecommendations: jest.fn().mockResolvedValue(recommendationHits),
          getPresets: jest.fn(),
        };
        const service = createSearchService(shopApi);

        await service.getRecommendations('product-1', 'en', 'main', 12);

        expect(shopApi.getRecommendations.mock.calls[0][1].filters).toEqual({
          '_product.published': 'true',
          '_product.categoryIds': ['root-a'],
        });
      });
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
      { addAdditionalData: jest.fn(async (products: unknown) => products) } as never,
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

  describe('getCatalogProductById', () => {
    const emptyBrowse = { hits: [], found: 0, page: 1, size: 1, facet_counts: [] };
    const logger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };

    function createService(overrides?: {
      browse?: jest.Mock;
      session?: Record<string, unknown> | null;
      mapToService?: jest.Mock;
      addAdditionalData?: jest.Mock;
      getProductById?: jest.Mock;
      rootIds?: string[];
    }) {
      const shopApi = {
        browse: overrides?.browse ?? jest.fn().mockResolvedValue(emptyBrowse),
        suggest: jest.fn(),
        getHighlights: jest.fn(),
        getRecommendations: jest.fn(),
        getPresets: jest.fn(),
      };
      const productMapper = {
        mapToService:
          overrides?.mapToService ??
          jest.fn().mockImplementation((product: { id?: string; _product?: { id?: string } }) => ({
            id: product.id ?? product._product?.id,
          })),
      };
      const productService = {
        addAdditionalData: overrides?.addAdditionalData ?? jest.fn(async (products: unknown) => products),
        getProductById: overrides?.getProductById ?? jest.fn(),
      };
      const service = new BatteryIncludedSearchService(
        shopApi as never,
        productMapper as never,
        {
          getCurrent: jest
            .fn()
            .mockResolvedValue(
              overrides?.session ?? { siteCode: 'main', language: 'en', country: 'DE', currency: 'EUR' },
            ),
        } as never,
        productService as never,
        { getSnapshot: jest.fn() } as never,
        { getRootCategoryIdsForSite: jest.fn().mockResolvedValue(overrides?.rootIds ?? ['root-a']) } as never,
        { getSite: jest.fn().mockResolvedValue({ defaultCountry: 'DE' }) } as never,
        logger as never,
      );
      return { service, shopApi, productMapper, productService };
    }

    it('browses by _product.id with visibility merge, maps the hit, and enriches without Product GET', async () => {
      const document = { id: 'sku-123', _product: { id: 'sku-123' } };
      const { service, shopApi, productMapper, productService } = createService({
        browse: jest.fn().mockResolvedValue({
          hits: [{ document }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        }),
      });

      const result = await service.getCatalogProductById('sku-123', undefined, 'en', 'main');

      expect(shopApi.browse).toHaveBeenCalledTimes(1);
      expect(shopApi.browse).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          size: 1,
          variants: 0,
          analyze: 0,
          visibility: expect.objectContaining({
            variables: expect.objectContaining({
              locale: 'en',
              siteAware: 'main',
            }),
            filters: expect.objectContaining({
              '_product.id': 'sku-123',
              '_product.published': 'true',
              '_product.categoryIds': ['root-a'],
            }),
          }),
        }),
      );
      expect(productMapper.mapToService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sku-123',
          __batteryIncludedSelection: {
            siteAware: 'main',
            currencyAware: 'EUR',
          },
        }),
      );
      expect(productService.addAdditionalData).toHaveBeenCalledWith([expect.objectContaining({ id: 'sku-123' })], {
        prices: false,
        variants: false,
        categories: false,
      });
      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: 'sku-123' }));
    });

    it('uses session language and siteCode for visibility variables when locale/site args are omitted', async () => {
      const document = { id: 'sku-123', _product: { id: 'sku-123' } };
      const { service, shopApi } = createService({
        session: { language: 'de', siteCode: 'preview', country: 'AT', currency: 'EUR' },
        browse: jest.fn().mockResolvedValue({
          hits: [{ document }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        }),
      });

      await service.getCatalogProductById('sku-123');

      expect(shopApi.browse).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: expect.objectContaining({
            variables: expect.objectContaining({
              locale: 'de',
              siteAware: 'preview',
            }),
          }),
        }),
      );
    });

    it('accepts a _product.id match even when the mapped product id differs', async () => {
      const document = { id: 'index-xyz', _product: { id: 'sku-123' } };
      const { service, shopApi, productService } = createService({
        browse: jest.fn().mockResolvedValue({
          hits: [{ document }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        }),
        mapToService: jest.fn().mockImplementation((product: { id?: string }) => ({ id: product.id })),
      });

      const result = await service.getCatalogProductById('sku-123', undefined, 'en', 'main');

      expect(shopApi.browse).toHaveBeenCalledTimes(1);
      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: 'index-xyz' }));
    });

    it('retries once with filter id when _product.id browse has no matching hit', async () => {
      const retryDocument = { id: 'sku-123', _product: { id: 'other' } };
      const browse = jest
        .fn()
        .mockResolvedValueOnce(emptyBrowse)
        .mockResolvedValueOnce({
          hits: [{ document: retryDocument }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        });
      const { service, shopApi, productService } = createService({ browse });

      const result = await service.getCatalogProductById('sku-123', undefined, 'en', 'main');

      expect(shopApi.browse).toHaveBeenCalledTimes(2);
      expect(shopApi.browse).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          visibility: expect.objectContaining({
            filters: expect.objectContaining({ '_product.id': 'sku-123' }),
          }),
        }),
      );
      expect(shopApi.browse).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          visibility: expect.objectContaining({
            filters: expect.objectContaining({ id: 'sku-123' }),
          }),
        }),
      );
      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: 'sku-123' }));
    });

    it('returns undefined without Product GET when both id filters return empty', async () => {
      const { service, shopApi, productService } = createService();

      const result = await service.getCatalogProductById('missing', undefined, 'en', 'main');

      expect(shopApi.browse).toHaveBeenCalledTimes(2);
      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(productService.addAdditionalData).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('returns undefined without browsing when published roots are empty', async () => {
      const { service, shopApi, productService } = createService({ rootIds: [] });

      const result = await service.getCatalogProductById('sku-123', undefined, 'en', 'main');

      expect(shopApi.browse).not.toHaveBeenCalled();
      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('forwards caller commerce options onto addAdditionalData defaults', async () => {
      const document = { id: 'sku-123', _product: { id: 'sku-123' } };
      const { service, productService } = createService({
        browse: jest.fn().mockResolvedValue({
          hits: [{ document }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        }),
      });

      await service.getCatalogProductById('sku-123', { prices: true }, 'en', 'main');

      expect(productService.addAdditionalData).toHaveBeenCalledWith([expect.objectContaining({ id: 'sku-123' })], {
        prices: true,
        variants: false,
        categories: false,
      });
    });

    it('adds segmentIds to both id-filter browse attempts and forwards them to addAdditionalData', async () => {
      const retryDocument = { id: 'sku-123', _product: { id: 'other' } };
      const browse = jest
        .fn()
        .mockResolvedValueOnce(emptyBrowse)
        .mockResolvedValueOnce({
          hits: [{ document: retryDocument }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        });
      const { service, shopApi, productService } = createService({ browse });

      const result = await service.getCatalogProductById('sku-123', { segmentIds: ['s1', 's2'] }, 'en', 'main');

      expect(shopApi.browse).toHaveBeenCalledTimes(2);
      expect(shopApi.browse).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          visibility: expect.objectContaining({
            filters: {
              '_product.id': 'sku-123',
              '_product_siteAware.segmentIds': ['s1', 's2'],
              '_product.published': 'true',
              '_product.categoryIds': ['root-a'],
            },
          }),
        }),
      );
      expect(shopApi.browse).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          visibility: expect.objectContaining({
            filters: {
              id: 'sku-123',
              '_product_siteAware.segmentIds': ['s1', 's2'],
              '_product.published': 'true',
              '_product.categoryIds': ['root-a'],
            },
          }),
        }),
      );
      expect(productService.addAdditionalData).toHaveBeenCalledWith([expect.objectContaining({ id: 'sku-123' })], {
        prices: false,
        variants: false,
        categories: false,
        segmentIds: ['s1', 's2'],
      });
      expect(result).toEqual(expect.objectContaining({ id: 'sku-123' }));
    });

    it('returns undefined when BI has no hit for a segment-scoped lookup', async () => {
      const { service, shopApi, productService } = createService();

      const result = await service.getCatalogProductById('sku-123', { segmentIds: ['s1'] }, 'en', 'main');

      expect(shopApi.browse).toHaveBeenCalledTimes(2);
      expect(shopApi.browse.mock.calls[0][0].visibility.filters).toMatchObject({
        '_product_siteAware.segmentIds': ['s1'],
      });
      expect(productService.addAdditionalData).not.toHaveBeenCalled();
      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('returns undefined without any BI call when options.segmentIds is [] (empty scope, fail closed)', async () => {
      const { service, shopApi, productService } = createService();

      const result = await service.getCatalogProductById('sku-123', { segmentIds: [] }, 'en', 'main');

      expect(shopApi.browse).not.toHaveBeenCalled();
      expect(productService.addAdditionalData).not.toHaveBeenCalled();
      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('omits the segmentIds filter from the PDP lookup when options.segmentIds is absent', async () => {
      const document = { id: 'sku-123', _product: { id: 'sku-123' } };
      const { service, shopApi } = createService({
        browse: jest.fn().mockResolvedValue({
          hits: [{ document }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        }),
      });

      await service.getCatalogProductById('sku-123', { prices: true }, 'en', 'main');

      expect(shopApi.browse.mock.calls[0][0].visibility.filters).not.toHaveProperty('_product_siteAware.segmentIds');
    });

    it('omits BI snapshot price and availability for prices=false catalog identities', async () => {
      const document = { id: 'sku-123', _product: { id: 'sku-123' } };
      const mapToService = jest.fn().mockReturnValue({
        id: 'sku-123',
        price: { currency: 'EUR', amount: 79 },
        availability: { isAvailable: true, availableQuantity: 5 },
      });
      const { service, productService } = createService({
        browse: jest.fn().mockResolvedValue({
          hits: [{ document }],
          found: 1,
          page: 1,
          size: 1,
          facet_counts: [],
        }),
        mapToService,
      });

      const result = await service.getCatalogProductById('sku-123', { prices: false }, 'en', 'main');

      expect(productService.addAdditionalData).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: 'sku-123',
            price: undefined,
            availability: undefined,
          }),
        ],
        { prices: false, variants: false, categories: false },
      );
      expect(result).toEqual(expect.objectContaining({ id: 'sku-123', price: undefined, availability: undefined }));
    });
  });
});
