/**
 * @jest-environment jsdom
 */
import EmporixSearchService from './EmporixSearchService';

describe('EmporixSearchService', () => {
  const productApi = {
    searchProducts: jest.fn(),
  };
  const productMapper = {
    mapToService: jest.fn(),
  };
  const sessionService = {
    getCurrent: jest.fn(),
  };
  const productService = {
    addAdditionalData: jest.fn(),
    getProductById: jest.fn(),
  };
  const segmentFilterService = {
    getCategoryScope: jest.fn(),
    getProductScope: jest.fn(),
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
  const aiApi = {
    searchCatalogWithProductRag: jest.fn(),
  };

  const createService = () =>
    new EmporixSearchService(
      sessionService as never,
      productApi as never,
      productMapper as never,
      productService as never,
      segmentFilterService as never,
      categoryService as never,
      logger as never,
      aiApi as never,
    );

  const mockSegmentScopes = (assignedCategoryIds: string[], productIds: string[]) => {
    segmentFilterService.getCategoryScope.mockResolvedValue({
      roots: [],
      treeCategoryIds: assignedCategoryIds,
      assignedCategoryIds,
      allowedCategoryIds: assignedCategoryIds,
    });
    segmentFilterService.getProductScope.mockResolvedValue({ productIds });
  };

  const originalOmitCatalogFilter = process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER;

  // jest.platform.setup.js resets every mock after each test, so implementations live here.
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER;
    productMapper.mapToService.mockImplementation((product: { id: string }) => ({ id: product.id }));
    productService.addAdditionalData.mockImplementation((products: unknown[]) => products);
    sessionService.getCurrent.mockResolvedValue({ currency: 'USD', siteCode: 'main' });
    productApi.searchProducts.mockResolvedValue({
      items: [{ id: 'product-1', name: { en: 'Alpha' } }],
      page: 1,
      size: 12,
      total: 1,
    });
    categoryService.getNavigationCategoryTrees.mockResolvedValue([{ id: 'root-1' }, { id: 'root-2' }]);
    aiApi.searchCatalogWithProductRag.mockResolvedValue({
      agentId: 'frontendAgent',
      agentType: 'frontend',
      sessionId: 'rag-session',
      message: '{}',
    });
  });

  afterAll(() => {
    if (originalOmitCatalogFilter === undefined) {
      delete process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER;
    } else {
      process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER = originalOmitCatalogFilter;
    }
  });

  it('exposes a safe product-name sort option while forwarding the raw sort token upstream', async () => {
    const service = createService();

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
      {
        id: 'price',
        labelKey: 'price',
        directions: ['asc', 'desc'],
        defaultDirection: 'asc',
      },
    ]);
  });

  it('delegates getCatalogProductById to ProductService.getProductById only (options passed through)', async () => {
    const catalogProduct = { id: 'product-1', name: { en: 'Alpha' } };
    productService.getProductById.mockResolvedValue(catalogProduct);

    const service = createService();

    const options = { prices: true, variants: true, segmentIds: ['s1'] };
    const result = await service.getCatalogProductById('product-1', options, 'en', 'main');

    expect(productService.getProductById).toHaveBeenCalledTimes(1);
    expect(productService.getProductById).toHaveBeenCalledWith('product-1', options);
    expect(productApi.searchProducts).not.toHaveBeenCalled();
    expect(result).toEqual(catalogProduct);
  });

  describe('without segmentIds (root-category scoping unchanged)', () => {
    it('scopes the default browse to the published navigation roots', async () => {
      const service = createService();

      await service.searchProducts({ page: 0, size: 12 }, 'en', 'main');

      expect(categoryService.getNavigationCategoryTrees).toHaveBeenCalledWith('main', false);
      expect(productApi.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({ criteria: { categoryIds: '(root-1,root-2)' } }),
      );
      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
      expect(segmentFilterService.getProductScope).not.toHaveBeenCalled();
    });

    it('passes user-selected categoryIds through unchanged', async () => {
      const service = createService();

      await service.searchProducts({ page: 0, size: 12, filters: { categoryIds: ['cat-1'] } }, 'en', 'main');

      expect(productApi.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({ criteria: { categoryIds: '(cat-1)' } }),
      );
    });
  });

  describe('with segmentIds (compoundLogicalQuery scoping, no post-filter)', () => {
    it('scopes the search with a compoundLogicalQuery fragment instead of root categoryIds and keeps the upstream total', async () => {
      mockSegmentScopes(['seg-cat-a', 'seg-cat-b'], ['seg-p1']);
      productApi.searchProducts.mockResolvedValue({
        items: [{ id: 'product-1' }, { id: 'product-2' }],
        page: 1,
        size: 12,
        total: 57,
      });
      const service = createService();

      const result = await service.searchProducts(
        { page: 0, size: 12, query: 'solar', segmentIds: ['s1'] },
        'en',
        'main',
      );

      expect(segmentFilterService.getCategoryScope).toHaveBeenCalledWith('main', ['s1'], expect.any(Promise));
      expect(segmentFilterService.getProductScope).toHaveBeenCalledWith('main', ['s1']);
      expect(categoryService.getNavigationCategoryTrees).not.toHaveBeenCalled();
      expect(productApi.searchProducts).toHaveBeenCalledTimes(2);
      const criteria = productApi.searchProducts.mock.calls[0][0].criteria as Record<string, string>;
      expect(criteria.compoundLogicalQuery.startsWith('compoundLogicalQuery:(')).toBe(true);
      expect(criteria.compoundLogicalQuery).toBe(
        'compoundLogicalQuery:((categoryIds:(seg-cat-a,seg-cat-b)) OR (id:(seg-p1)))',
      );
      expect(criteria.name).toBe('~solar');
      expect(criteria).not.toHaveProperty('categoryIds');
      expect(result.total).toBe(57);
      expect(result.items).toHaveLength(2);
    });

    it('narrows the segment scope with the (sanitised) selected category filter', async () => {
      mockSegmentScopes(['seg-cat-a'], []);
      const service = createService();

      await service.searchProducts(
        { page: 0, size: 12, segmentIds: ['s1'], filters: { categoryIds: 'sel-1' } },
        'en',
        'main',
      );

      const criteria = productApi.searchProducts.mock.calls[0][0].criteria as Record<string, string>;
      expect(criteria.compoundLogicalQuery).toBe(
        'compoundLogicalQuery:((categoryIds:(sel-1)) AND (categoryIds:(seg-cat-a)))',
      );
      expect(criteria).not.toHaveProperty('categoryIds');
    });

    it('returns an empty result without calling the product API when both scopes are empty', async () => {
      mockSegmentScopes([], []);
      const service = createService();

      const result = await service.searchProducts({ page: 0, size: 12, segmentIds: ['s1'] }, 'en', 'main');

      expect(productApi.searchProducts).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ items: [], total: 0, page: 0, pageSize: 12 }));
    });

    it('still applies the compound scope when searchAllProducts is true', async () => {
      mockSegmentScopes(['seg-cat-a'], ['seg-p1']);
      const service = createService();

      await service.searchProducts({ page: 0, size: 12, segmentIds: ['s1'], searchAllProducts: true }, 'en', 'main');

      const criteria = productApi.searchProducts.mock.calls[0][0].criteria as Record<string, string>;
      expect(criteria.compoundLogicalQuery).toBe('compoundLogicalQuery:((categoryIds:(seg-cat-a)) OR (id:(seg-p1)))');
    });

    it('still applies the compound scope when NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER is true', async () => {
      process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER = 'true';
      mockSegmentScopes(['seg-cat-a'], ['seg-p1']);
      const service = createService();

      await service.searchProducts({ page: 0, size: 12, segmentIds: ['s1'] }, 'en', 'main');

      const criteria = productApi.searchProducts.mock.calls[0][0].criteria as Record<string, string>;
      expect(criteria.compoundLogicalQuery).toBe('compoundLogicalQuery:((categoryIds:(seg-cat-a)) OR (id:(seg-p1)))');
    });

    it('resolves the site from the session when no site is given and fails closed without one', async () => {
      mockSegmentScopes(['seg-cat-a'], []);
      sessionService.getCurrent.mockResolvedValueOnce({ currency: 'USD', siteCode: 'de' });
      const service = createService();

      await service.searchProducts({ page: 0, size: 12, segmentIds: ['s1'] });
      expect(segmentFilterService.getCategoryScope).toHaveBeenCalledWith('de', ['s1'], expect.any(Promise));

      jest.clearAllMocks();
      sessionService.getCurrent.mockResolvedValueOnce({ currency: 'USD' });
      const result = await service.searchProducts({ page: 0, size: 12, segmentIds: ['s1'] });

      expect(productApi.searchProducts).not.toHaveBeenCalled();
      expect(result.total).toBe(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('warns (without truncating) when the product scope exceeds 200 ids', async () => {
      const productIds = Array.from({ length: 201 }, (_, i) => `p${i}`);
      mockSegmentScopes([], productIds);
      const service = createService();

      await service.searchProducts({ page: 0, size: 12, segmentIds: ['s1'] }, 'en', 'main');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ productIds: 201 }),
        expect.stringContaining('very large'),
      );
      const criteria = productApi.searchProducts.mock.calls[0][0].criteria as Record<string, string>;
      expect(criteria.compoundLogicalQuery).toContain('p200');
    });

    it('returns an empty result without any upstream call when segmentIds is [] (empty scope, fail closed)', async () => {
      const service = createService();

      const result = await service.searchProducts({ page: 0, size: 12, query: 'solar', segmentIds: [] }, 'en', 'main');

      expect(productApi.searchProducts).not.toHaveBeenCalled();
      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
      expect(segmentFilterService.getProductScope).not.toHaveBeenCalled();
      expect(categoryService.getNavigationCategoryTrees).not.toHaveBeenCalled();
      expect(aiApi.searchCatalogWithProductRag).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ items: [], total: 0, page: 0, pageSize: 12 }));
    });

    it('returns empty suggestions without any upstream call when segmentIds is []', async () => {
      const service = createService();

      const result = await service.getSuggestions({ query: 'sol', segmentIds: [], site: 'main' });

      expect(productApi.searchProducts).not.toHaveBeenCalled();
      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
      expect(result).toEqual({ queryCompletions: [], products: [], categories: [] });
    });

    it('applies the same compound scope to suggestions', async () => {
      mockSegmentScopes(['seg-cat-a'], ['seg-p1']);
      const service = createService();

      const result = await service.getSuggestions({
        page: 0,
        size: 12,
        query: 'sol',
        segmentIds: ['s1'],
        site: 'main',
      });

      const criteria = productApi.searchProducts.mock.calls[0][0].criteria as Record<string, string>;
      expect(criteria.compoundLogicalQuery).toBe('compoundLogicalQuery:((categoryIds:(seg-cat-a)) OR (id:(seg-p1)))');
      expect(criteria.name).toBe('~sol');
      expect(result.products).toHaveLength(1);
    });
  });

  describe('getRecommendations', () => {
    it('returns [] without any upstream call when segmentIds is []', async () => {
      const service = createService();

      await expect(
        service.getRecommendations('product-1', 'en', 'main', 12, undefined, { segmentIds: [] }),
      ).resolves.toEqual({
        products: [],
        crossSell: [],
        upSell: [],
      });

      expect(productService.getProductById).not.toHaveBeenCalled();
      expect(productApi.searchProducts).not.toHaveBeenCalled();
    });

    it('loads related items and keeps upsell separate from cross-sell', async () => {
      productService.getProductById.mockResolvedValue({
        id: 'product-1',
        relatedItems: [
          { refId: 'acc-1', type: 'Accessory' },
          { refId: 'up-1', type: 'Upsell' },
        ],
      });
      productApi.searchProducts.mockResolvedValue({
        items: [
          { id: 'acc-1', name: { en: 'Accessory' } },
          { id: 'up-1', name: { en: 'Upsell' } },
        ],
        page: 1,
        size: 2,
        total: 2,
      });
      const service = createService();

      const result = await service.getRecommendations('product-1', 'en', 'main', 12);

      expect(productService.getProductById).toHaveBeenCalledWith('product-1', {
        categories: true,
        prices: false,
        variants: false,
        segmentIds: undefined,
        siteCode: 'main',
      });
      const criteria = productApi.searchProducts.mock.calls[0][0].criteria as Record<string, string>;
      expect(criteria.id).toBe('(acc-1,up-1)');
      expect(criteria.categoryIds).toBe('(root-1,root-2)');
      expect(result.crossSell).toEqual([{ id: 'acc-1' }]);
      expect(result.upSell).toEqual([{ id: 'up-1' }]);
      expect(result.products).toEqual([{ id: 'acc-1' }, { id: 'up-1' }]);
    });
  });

  describe('product RAG fallback', () => {
    const ragMessage = JSON.stringify({
      type: 'product_list',
      data: {
        products: [{ productId: 'solar-2' }, { productId: 'solar-1' }],
      },
    });

    function mockKeywordMiss() {
      productApi.searchProducts.mockImplementation(async (request: { criteria?: { id?: string } }) => {
        if (request.criteria?.id === '(solar-2,solar-1)') {
          return {
            items: [
              { id: 'solar-1', name: { en: 'Solar One' } },
              { id: 'solar-2', name: { en: 'Solar Two' } },
            ],
            page: 1,
            size: 2,
            total: 2,
          };
        }
        return { items: [], page: 1, size: 12, total: 0 };
      });
      aiApi.searchCatalogWithProductRag.mockResolvedValue({
        agentId: 'frontendAgent',
        agentType: 'frontend',
        sessionId: 'rag-session',
        message: ragMessage,
      });
    }

    it('keeps a keyword hit off the agent', async () => {
      const service = createService();

      await service.searchProducts({ page: 0, size: 12, query: 'solar' }, 'en', 'main');

      expect(aiApi.searchCatalogWithProductRag).not.toHaveBeenCalled();
    });

    it('loads RAG product ids through the catalog scope when the keyword search is empty', async () => {
      mockKeywordMiss();
      const service = createService();

      const result = await service.searchProducts({ page: 0, size: 12, query: 'soler' }, 'en', 'main');

      expect(aiApi.searchCatalogWithProductRag).toHaveBeenCalledWith(
        'Find products matching this search, including close spellings: soler',
        { siteId: 'main', currency: 'USD', language: 'en' },
      );
      const idCall = productApi.searchProducts.mock.calls.find(
        (call: Array<{ criteria?: { id?: string } }>) => call[0].criteria?.id === '(solar-2,solar-1)',
      );
      expect(idCall?.[0].criteria).toEqual(
        expect.objectContaining({
          id: '(solar-2,solar-1)',
          categoryIds: '(root-1,root-2)',
        }),
      );
      expect(result.items).toEqual([{ id: 'solar-2' }, { id: 'solar-1' }]);
      expect(result.total).toBe(2);
    });

    it('returns the keyword miss when the agent fails', async () => {
      productApi.searchProducts.mockResolvedValue({ items: [], page: 1, size: 12, total: 0 });
      aiApi.searchCatalogWithProductRag.mockRejectedValue(new Error('agent down'));
      const service = createService();

      const result = await service.searchProducts({ page: 0, size: 12, query: 'soler' }, 'en', 'main');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'soler' }),
        'Product RAG fallback failed',
      );
    });

    it('does not call the agent for a two-character query', async () => {
      productApi.searchProducts.mockResolvedValue({ items: [], page: 1, size: 12, total: 0 });
      const service = createService();

      await service.searchProducts({ page: 0, size: 12, query: 'ab' }, 'en', 'main');

      expect(aiApi.searchCatalogWithProductRag).not.toHaveBeenCalled();
    });

    it('fills suggestions from the product RAG when keyword search is empty', async () => {
      mockKeywordMiss();
      const service = createService();

      const result = await service.getSuggestions({ query: 'soler', site: 'main', locale: 'en' });

      expect(aiApi.searchCatalogWithProductRag).toHaveBeenCalledTimes(1);
      expect(result.products).toEqual([{ id: 'solar-2' }, { id: 'solar-1' }]);
    });
  });
});
