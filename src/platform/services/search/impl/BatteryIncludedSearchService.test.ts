import BatteryIncludedSearchService from './BatteryIncludedSearchService';

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
        variables: {
          locale: 'en',
          siteAware: 'main',
          countryAware: 'DE',
          currencyAware: 'EUR',
        },
        filters: {
          color: ['red'],
          '_product_i18n.categoryBreadcrumbs.displayPath': 'Cables > USB-C',
        },
      }),
    );
    expect(result.availableFilters).toHaveLength(1);
    expect(result.availableFilters[0]).toMatchObject({
      id: 'color',
      values: [{ id: 'red', active: true }],
    });
  });

  it('returns typed BatteryIncluded facets alongside legacy availableFilters and falls back to select when rating classification does not match', async () => {
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
            field_label: 'Finish',
            type: 'select',
            stats: { total_values: 2 },
            counts: [
              { count: 4, value: 'red' },
              { count: 2, value: 'blue' },
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
            field_name: 'price',
            field_label: 'Net price',
            type: 'range',
            stats: { total_values: 2 },
            counts: [
              { count: 10, value: 'from' },
              { count: 20, value: 'till' },
            ],
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
            field_name: 'customerRating',
            type: 'select',
            stats: { total_values: 1 },
            counts: [{ count: 1, value: '4' }],
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

    expect(result.availableFilters).toEqual([
      {
        id: 'color',
        name: 'Finish',
        labelIsPlainText: true,
        values: [
          { id: 'red', name: 'red', active: true, count: 4 },
          { id: 'blue', name: 'blue', active: false, count: 2 },
        ],
      },
      {
        id: 'brandTree',
        name: 'brandTree',
        labelIsPlainText: true,
        values: [{ id: 'Power Tools > Drills', name: 'Power Tools > Drills', active: true, count: 3 }],
      },
      {
        id: 'price',
        name: 'Net price',
        labelIsPlainText: true,
        values: [
          { id: '10', name: '10', active: false },
          { id: '20', name: '20', active: false },
        ],
      },
      {
        id: 'rating',
        name: 'rating',
        labelIsPlainText: true,
        values: [
          { id: '4', name: '4 stars & up', active: true, count: 6 },
          { id: '5', name: '5 stars & up', active: false, count: 3 },
        ],
      },
      {
        id: 'customerRating',
        name: 'customerRating',
        labelIsPlainText: true,
        values: [{ id: '4', name: '4', active: true, count: 1 }],
      },
    ]);
    expect(result.batteryIncludedFacets).toEqual([
      {
        id: 'color',
        label: 'Finish',
        kind: 'select',
        options: [
          { id: 'red', label: 'red', active: true, count: 4 },
          { id: 'blue', label: 'blue', active: false, count: 2 },
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
        id: 'price',
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
        id: 'customerRating',
        label: 'customerRating',
        kind: 'select',
        options: [{ id: '4', label: '4', active: true, count: 1 }],
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
        variables: {
          locale: 'en',
          siteAware: 'main',
          countryAware: 'DE',
        },
        filters: {
          categoryIds: 'child-a',
        },
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
        variables: {
          locale: 'en',
          siteAware: 'main',
          countryAware: 'DE',
          currencyAware: 'EUR',
        },
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
        variables: {
          locale: 'en',
          siteAware: 'main',
          countryAware: 'DE',
        },
        filters: {
          categoryIds: 'child-a',
        },
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
        variables: {
          locale: 'en',
          siteAware: 'main',
        },
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
      variables: {
        locale: 'en',
        siteAware: 'main',
        countryAware: 'DE',
        currencyAware: 'EUR',
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
      variables: {
        locale: 'en',
        siteAware: 'main',
        countryAware: 'DE',
        currencyAware: 'EUR',
      },
      segmentIds: ['seg-a', 'seg-b'],
    });
  });
});
