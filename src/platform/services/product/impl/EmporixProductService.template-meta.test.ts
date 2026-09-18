import type { Product } from '@/platform/services/model/product';
import EmporixProductService from './EmporixProductService';

describe('EmporixProductService template meta enrichment', () => {
  function createService(overrides?: {
    searchProducts?: jest.Mock;
    getProducts?: jest.Mock;
    getProductTemplate?: jest.Mock;
    getProduct?: jest.Mock;
    getProductPrices?: jest.Mock;
    mapToService?: jest.Mock;
    filterProductIdsInScope?: jest.Mock;
    getCurrent?: jest.Mock;
    logger?: { warn: jest.Mock; error: jest.Mock };
  }): EmporixProductService {
    const searchProducts =
      overrides?.searchProducts ??
      jest.fn().mockResolvedValue({
        items: [
          {
            id: 'prod-1',
            template: { id: 'tmpl-1', version: 2 },
          },
        ],
      });
    const getProductTemplate =
      overrides?.getProductTemplate ??
      jest.fn().mockResolvedValue({
        id: 'tmpl-1',
        name: { en: 'Template' },
        attributes: [
          {
            key: 'pick-a-list-optional',
            name: { en: 'Pick a list (optional)' },
            type: 'TEXT',
          },
          {
            key: 'to-be-or-not-to-be',
            name: { en: 'To be or not to be' },
            type: 'BOOLEAN',
          },
        ],
      });

    const logger = overrides?.logger ?? { error: jest.fn(), warn: jest.fn() };

    return new EmporixProductService(
      { getProductPrices: overrides?.getProductPrices ?? jest.fn().mockResolvedValue(new Map()) } as never,
      { mapToService: overrides?.mapToService ?? jest.fn() } as never,
      {
        searchProducts,
        getProduct: overrides?.getProduct ?? jest.fn(),
        getProducts: overrides?.getProducts ?? jest.fn(),
      } as never,
      { getBrand: jest.fn() } as never,
      { getLabels: jest.fn(), getLabel: jest.fn() } as never,
      { getProductTemplate } as never,
      { getCategoriesForProduct: jest.fn() } as never,
      { filterProductIdsInScope: overrides?.filterProductIdsInScope ?? jest.fn() } as never,
      { getCurrent: overrides?.getCurrent ?? jest.fn().mockResolvedValue(null) } as never,
      logger as never,
    );
  }

  describe('segment scope (segmentIds)', () => {
    const rawProduct = { id: 'p1', code: 'c1', name: { en: 'P1' } };
    const mapToService = jest.fn();
    const getCurrent = jest.fn();

    // Jest resets mock implementations between tests, so (re)apply them here.
    beforeEach(() => {
      mapToService.mockImplementation((product: { id: string }) => ({
        id: product.id,
        name: { en: product.id },
        description: {},
        purchasable: true,
      }));
      getCurrent.mockResolvedValue({ siteCode: 'main' });
    });

    it('getProductById returns undefined for an out-of-scope product', async () => {
      const filterProductIdsInScope = jest.fn().mockResolvedValue(new Set());
      const service = createService({
        getProduct: jest.fn().mockResolvedValue(rawProduct),
        mapToService,
        filterProductIdsInScope,
        getCurrent,
      });

      await expect(service.getProductById('p1', { segmentIds: ['s1'] })).resolves.toBeUndefined();

      expect(filterProductIdsInScope).toHaveBeenCalledWith(['p1'], 'main', ['s1']);
      expect(mapToService).not.toHaveBeenCalled();
    });

    it('getProductById returns the mapped product when it is in scope', async () => {
      const filterProductIdsInScope = jest.fn().mockResolvedValue(new Set(['p1']));
      const service = createService({
        getProduct: jest.fn().mockResolvedValue(rawProduct),
        mapToService,
        filterProductIdsInScope,
        getCurrent,
      });

      const product = await service.getProductById('p1', { segmentIds: ['s1'] });

      expect(product?.id).toBe('p1');
      expect(filterProductIdsInScope).toHaveBeenCalledWith(['p1'], 'main', ['s1']);
    });

    it('getProductById skips the scope check without segmentIds', async () => {
      const filterProductIdsInScope = jest.fn();
      const service = createService({
        getProduct: jest.fn().mockResolvedValue(rawProduct),
        mapToService,
        filterProductIdsInScope,
        getCurrent,
      });

      const product = await service.getProductById('p1', {});

      expect(product?.id).toBe('p1');
      expect(filterProductIdsInScope).not.toHaveBeenCalled();
    });

    it('getProductById checks membership for the effective options.siteCode, not the session site', async () => {
      const filterProductIdsInScope = jest.fn().mockResolvedValue(new Set(['p1']));
      const service = createService({
        getProduct: jest.fn().mockResolvedValue(rawProduct),
        mapToService,
        filterProductIdsInScope,
        getCurrent,
      });

      const product = await service.getProductById('p1', { segmentIds: ['s1'], siteCode: 'us' });

      expect(product?.id).toBe('p1');
      expect(filterProductIdsInScope).toHaveBeenCalledWith(['p1'], 'us', ['s1']);
      expect(getCurrent).not.toHaveBeenCalled();
    });

    it('getProductById falls back to the session site when options.siteCode is blank', async () => {
      const filterProductIdsInScope = jest.fn().mockResolvedValue(new Set(['p1']));
      const service = createService({
        getProduct: jest.fn().mockResolvedValue(rawProduct),
        mapToService,
        filterProductIdsInScope,
        getCurrent,
      });

      await service.getProductById('p1', { segmentIds: ['s1'], siteCode: '   ' });

      expect(filterProductIdsInScope).toHaveBeenCalledWith(['p1'], 'main', ['s1']);
    });

    it('getProductById fails closed when the session has no site', async () => {
      const filterProductIdsInScope = jest.fn();
      const service = createService({
        getProduct: jest.fn().mockResolvedValue(rawProduct),
        mapToService,
        filterProductIdsInScope,
        getCurrent: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getProductById('p1', { segmentIds: ['s1'] })).resolves.toBeUndefined();
      expect(filterProductIdsInScope).not.toHaveBeenCalled();
    });

    it('isInSegmentScope is true when unscoped and false for an empty or out-of-scope id', async () => {
      const inScope = jest.fn().mockResolvedValue(new Set(['p1']));
      const outOfScope = jest.fn().mockResolvedValue(new Set());
      const unscoped = createService({ filterProductIdsInScope: jest.fn(), getCurrent });
      const allowed = createService({ filterProductIdsInScope: inScope, getCurrent });
      const denied = createService({ filterProductIdsInScope: outOfScope, getCurrent });

      await expect(unscoped.isInSegmentScope('p1')).resolves.toBe(true);
      await expect(unscoped.isInSegmentScope('p1', {})).resolves.toBe(true);
      await expect(unscoped.isInSegmentScope('p1', { segmentIds: [] })).resolves.toBe(false);
      await expect(allowed.isInSegmentScope('p1', { segmentIds: ['s1'], siteCode: 'us' })).resolves.toBe(true);
      expect(inScope).toHaveBeenCalledWith(['p1'], 'us', ['s1']);
      await expect(denied.isInSegmentScope('p1', { segmentIds: ['s1'] })).resolves.toBe(false);
    });

    it('getProductById returns undefined without any upstream call when segmentIds is [] (empty scope)', async () => {
      const getProduct = jest.fn().mockResolvedValue(rawProduct);
      const filterProductIdsInScope = jest.fn();
      const service = createService({ getProduct, mapToService, filterProductIdsInScope, getCurrent });

      await expect(service.getProductById('p1', { segmentIds: [] })).resolves.toBeUndefined();

      expect(getProduct).not.toHaveBeenCalled();
      expect(filterProductIdsInScope).not.toHaveBeenCalled();
      expect(mapToService).not.toHaveBeenCalled();
    });

    it('getVariantProducts returns [] without any upstream call when segmentIds is [] (empty scope)', async () => {
      const searchProducts = jest.fn();
      const filterProductIdsInScope = jest.fn();
      const service = createService({ searchProducts, mapToService, filterProductIdsInScope, getCurrent });

      await expect(service.getVariantProducts('p1', { segmentIds: [] })).resolves.toEqual([]);

      expect(searchProducts).not.toHaveBeenCalled();
      expect(filterProductIdsInScope).not.toHaveBeenCalled();
    });

    it('getProducts reports the filtered page total instead of the unscoped catalog total', async () => {
      const getProducts = jest.fn().mockResolvedValue({
        items: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        page: 0,
        size: 20,
        total: 99,
      });
      const filterProductIdsInScope = jest.fn().mockResolvedValue(new Set(['p2']));
      const service = createService({ getProducts, mapToService, filterProductIdsInScope, getCurrent });

      const result = await service.getProducts(0, 20, { segmentIds: ['s1'], siteCode: 'main' });

      expect(result.items.map((product) => product.id)).toEqual(['p2']);
      expect(result.total).toBe(1);
      expect(getProducts).toHaveBeenCalledWith(0, 20);
    });

    it('getProducts returns an empty page without an upstream call when segmentIds is []', async () => {
      const getProducts = jest.fn();
      const service = createService({ getProducts, mapToService, filterProductIdsInScope: jest.fn(), getCurrent });

      await expect(service.getProducts(0, 20, { segmentIds: [] })).resolves.toEqual({
        items: [],
        page: 0,
        pageSize: 20,
        total: 0,
      });
      expect(getProducts).not.toHaveBeenCalled();
    });

    it('getVariantProducts keeps only in-scope variants', async () => {
      const searchProducts = jest.fn().mockResolvedValue({
        items: [{ id: 'v1', parentVariantId: 'p1' }, { id: 'v2', parentVariantId: 'p1' }, { parentVariantId: 'p1' }],
      });
      const filterProductIdsInScope = jest.fn().mockResolvedValue(new Set(['v2']));
      const service = createService({ searchProducts, mapToService, filterProductIdsInScope, getCurrent });

      const variants = await service.getVariantProducts('p1', { segmentIds: ['s1'] });

      expect(filterProductIdsInScope).toHaveBeenCalledWith(['v1', 'v2'], 'main', ['s1']);
      expect(variants.map((variant) => variant.id)).toEqual(['v2']);
    });

    it('addAdditionalData forwards only the segment scope (segmentIds + siteCode) into getVariantProducts', async () => {
      const service = createService({ searchProducts: jest.fn(), mapToService, getCurrent });
      const getVariantProducts = jest.spyOn(service, 'getVariantProducts').mockResolvedValue([]);
      const segmentIds = ['s1'];

      await service.addAdditionalData(
        [{ id: 'p1', name: { en: 'P1' }, description: {}, purchasable: true, template: { id: 'tmpl-1' } }],
        { variants: true, prices: true, categories: false, segmentIds, siteCode: 'us' },
      );

      expect(getVariantProducts).toHaveBeenCalledTimes(1);
      const [, forwardedOptions] = getVariantProducts.mock.calls[0];
      expect(forwardedOptions).toEqual({ segmentIds, siteCode: 'us' });
      expect(Object.keys(forwardedOptions ?? {}).sort()).toEqual(['segmentIds', 'siteCode']);
    });
  });

  it('resolves missing template.id via product search then fills labels/types from Templates API', async () => {
    const searchProducts = jest.fn().mockResolvedValue({
      items: [{ id: 'prod-1', code: 'c1', template: { id: 'tmpl-1', version: 2 } }],
    });
    const getProductTemplate = jest.fn().mockResolvedValue({
      id: 'tmpl-1',
      name: { en: 'Template' },
      attributes: [
        { key: 'pick-a-list-optional', name: { en: 'Pick a list (optional)' }, type: 'TEXT' },
        { key: 'to-be-or-not-to-be', name: { en: 'To be or not to be' }, type: 'BOOLEAN' },
      ],
    });
    const service = createService({ searchProducts, getProductTemplate });

    const products: Product[] = [
      {
        id: 'prod-1',
        name: { en: 'Sample' },
        description: {},
        purchasable: true,
        templateAttributes: {
          'pick-a-list-optional': 'Value 4',
          'to-be-or-not-to-be': 'True',
        },
      },
    ];

    const [enriched] = await service.addAdditionalData(products, {
      prices: false,
      variants: false,
      categories: false,
    });

    expect(searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 0,
        criteria: { id: '(prod-1)' },
        expand: ['template', 'parentVariant'],
      }),
    );
    expect(getProductTemplate).toHaveBeenCalledWith('tmpl-1', '2');
    expect(enriched.template).toEqual({ id: 'tmpl-1', version: '2' });
    expect(enriched.templateAttributeLabels).toEqual({
      'pick-a-list-optional': { en: 'Pick a list (optional)' },
      'to-be-or-not-to-be': { en: 'To be or not to be' },
    });
    expect(enriched.templateAttributeTypes).toEqual({
      'pick-a-list-optional': 'TEXT',
      'to-be-or-not-to-be': 'BOOLEAN',
    });
    expect(enriched.templateAttributeOrder).toEqual(['pick-a-list-optional', 'to-be-or-not-to-be']);
  });

  it('skips product search when template.id is already present', async () => {
    const searchProducts = jest.fn();
    const getProductTemplate = jest.fn().mockResolvedValue({
      id: 'tmpl-1',
      name: { en: 'Template' },
      attributes: [{ key: 'pick-a-list-optional', name: { en: 'Pick a list (optional)' }, type: 'TEXT' }],
    });
    const service = createService({ searchProducts, getProductTemplate });

    const products: Product[] = [
      {
        id: 'prod-1',
        name: { en: 'Sample' },
        description: {},
        purchasable: true,
        template: { id: 'tmpl-1' },
        templateAttributes: { 'pick-a-list-optional': 'Value 4' },
      },
    ];

    await service.addAdditionalData(products, { prices: false, variants: false, categories: false });

    expect(searchProducts).not.toHaveBeenCalled();
    expect(getProductTemplate).toHaveBeenCalledWith('tmpl-1', undefined);
  });

  it('fetches Templates API even when expand already mapped key-echo labels', async () => {
    const getProductTemplate = jest.fn().mockResolvedValue({
      id: 'tmpl-1',
      name: { en: 'Template' },
      attributes: [
        {
          key: 'a-very-long-attribute-name-to-test-wrapping',
          name: { en: 'A Very Long Attribute Name To Test Wrapping' },
          type: 'TEXT',
        },
        { key: 'date-attribute', name: { en: 'Date attribute' }, type: 'DATETIME' },
      ],
    });
    const service = createService({ searchProducts: jest.fn(), getProductTemplate });

    const products: Product[] = [
      {
        id: 'prod-1',
        name: { en: 'Sample' },
        description: {},
        purchasable: false,
        isParentVariant: true,
        template: { id: 'tmpl-1', version: '2' },
        templateAttributeLabels: {
          'a-very-long-attribute-name-to-test-wrapping': { en: 'a-very-long-attribute-name-to-test-wrapping' },
          'date-attribute': { en: 'date-attribute' },
        },
        variantAttributes: [
          {
            key: 'a-very-long-attribute-name-to-test-wrapping',
            name: { en: 'a-very-long-attribute-name-to-test-wrapping' },
            values: [{ key: 'First option', selected: true }],
          },
          {
            key: 'date-attribute',
            name: { en: 'date-attribute' },
            values: [{ key: '2026-08-27T09:05:45.279Z', selected: true }],
          },
        ],
      },
    ];

    const [enriched] = await service.addAdditionalData(products, {
      prices: false,
      variants: false,
      categories: false,
    });

    expect(getProductTemplate).toHaveBeenCalledWith('tmpl-1', '2');
    expect(enriched.templateAttributeLabels).toEqual({
      'a-very-long-attribute-name-to-test-wrapping': { en: 'A Very Long Attribute Name To Test Wrapping' },
      'date-attribute': { en: 'Date attribute' },
    });
    expect(enriched.templateAttributeTypes).toEqual({
      'a-very-long-attribute-name-to-test-wrapping': 'TEXT',
      'date-attribute': 'DATETIME',
    });
    expect(enriched.variantAttributes?.[0].name).toEqual({ en: 'A Very Long Attribute Name To Test Wrapping' });
    expect(enriched.variantAttributes?.[1].name).toEqual({ en: 'Date attribute' });
  });

  it('resolves template.id for variant-only products without templateAttributes', async () => {
    const searchProducts = jest.fn().mockResolvedValue({
      items: [{ id: 'prod-1', template: { id: 'tmpl-1', version: 3 } }],
    });
    const getProductTemplate = jest.fn().mockResolvedValue({
      id: 'tmpl-1',
      name: { en: 'Template' },
      attributes: [{ key: 'width', name: { en: 'Width' }, type: 'NUMBER' }],
    });
    const service = createService({ searchProducts, getProductTemplate });

    const products: Product[] = [
      {
        id: 'prod-1',
        name: { en: 'Sample' },
        description: {},
        purchasable: false,
        isParentVariant: true,
        variantAttributes: [{ key: 'width', values: [{ key: '20', selected: true }] }],
      },
    ];

    const [enriched] = await service.addAdditionalData(products, {
      prices: false,
      variants: false,
      categories: false,
    });

    expect(searchProducts).toHaveBeenCalled();
    expect(getProductTemplate).toHaveBeenCalledWith('tmpl-1', '3');
    expect(enriched.variantAttributes?.[0].name).toEqual({ en: 'Width' });
  });

  it('overlays template labels onto nested child variants', async () => {
    const getProductTemplate = jest.fn().mockResolvedValue({
      id: 'tmpl-1',
      name: { en: 'Template' },
      attributes: [{ key: 'width', name: { en: 'Width' }, type: 'NUMBER' }],
    });
    const service = createService({ searchProducts: jest.fn(), getProductTemplate });

    const products: Product[] = [
      {
        id: 'parent-1',
        name: { en: 'Parent' },
        description: {},
        purchasable: false,
        isParentVariant: true,
        template: { id: 'tmpl-1' },
        variantAttributes: [{ key: 'width', name: { en: 'width' }, values: [] }],
        variants: [
          {
            id: 'child-1',
            name: { en: 'Child' },
            description: {},
            purchasable: true,
            parentVariantId: 'parent-1',
            variantAttributes: [{ key: 'width', name: { en: 'width' }, values: [{ key: '20', selected: true }] }],
          },
        ],
      },
    ];

    const [enriched] = await service.addAdditionalData(products, {
      prices: false,
      variants: false,
      categories: false,
    });

    expect(enriched.variants?.[0].templateAttributeLabels).toEqual({ width: { en: 'Width' } });
    expect(enriched.variants?.[0].variantAttributes?.[0].name).toEqual({ en: 'Width' });
    expect(enriched.variants?.[0].templateAttributeTypes).toEqual({ width: 'NUMBER' });
  });

  it('resolves a child VARIANT template from the parent product search hit', async () => {
    const searchProducts = jest.fn().mockResolvedValue({
      items: [
        { id: 'child-1', parentVariantId: 'parent-1' },
        { id: 'parent-1', template: { id: 'tmpl-1', version: 5 } },
      ],
    });
    const getProductTemplate = jest.fn().mockResolvedValue({
      id: 'tmpl-1',
      name: { en: 'Template' },
      attributes: [{ key: 'date-attribute', name: { en: 'Date attribute' }, type: 'DATETIME' }],
    });
    const service = createService({ searchProducts, getProductTemplate });

    const products: Product[] = [
      {
        id: 'child-1',
        name: { en: 'Child' },
        description: {},
        purchasable: true,
        parentVariantId: 'parent-1',
        variantAttributes: [
          {
            key: 'date-attribute',
            values: [{ key: '2026-08-27T09:05:45.279Z', selected: true }],
          },
        ],
      },
    ];

    const [enriched] = await service.addAdditionalData(products, {
      prices: false,
      variants: false,
      categories: false,
    });

    expect(enriched.template).toEqual({ id: 'tmpl-1', version: '5' });
    expect(enriched.variantAttributes?.[0].name).toEqual({ en: 'Date attribute' });
    expect(enriched.templateAttributeTypes).toEqual({ 'date-attribute': 'DATETIME' });
  });

  it('returns products when template-ref product search fails', async () => {
    const searchProducts = jest.fn().mockRejectedValue(new Error('Failed to search products: 503 no available server'));
    const getProductTemplate = jest.fn();
    const logger = { error: jest.fn(), warn: jest.fn() };
    const service = new EmporixProductService(
      { getProductPrices: jest.fn().mockResolvedValue(new Map()) } as never,
      { mapToService: jest.fn() } as never,
      { searchProducts, getProduct: jest.fn() } as never,
      { getBrand: jest.fn() } as never,
      { getLabels: jest.fn(), getLabel: jest.fn() } as never,
      { getProductTemplate } as never,
      { getCategoriesForProduct: jest.fn() } as never,
      { filterProductIdsInScope: jest.fn() } as never,
      { getCurrent: jest.fn().mockResolvedValue(null) } as never,
      logger as never,
    );

    const products: Product[] = [
      {
        id: 'prod-1',
        name: { en: 'Sample' },
        description: {},
        purchasable: true,
        templateAttributes: { 'pick-a-list-optional': 'Value 4' },
      },
    ];

    const [enriched] = await service.addAdditionalData(products, {
      prices: false,
      variants: false,
      categories: false,
    });

    expect(enriched.id).toBe('prod-1');
    expect(enriched.template).toBeUndefined();
    expect(getProductTemplate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ message: expect.stringContaining('503') }) }),
      'Failed to resolve product template refs; continuing without them',
    );
  });

  it('keeps the catalog product when price enrichment fails (COP-4822: price 404 is not a PDP 404)', async () => {
    const getProductPrices = jest.fn().mockRejectedValue(new Error('Failed to match prices: Not Found'));
    const logger = { error: jest.fn(), warn: jest.fn() };
    const service = createService({ getProductPrices, logger });
    const products: Product[] = [
      {
        id: 'prod-priced',
        name: { en: 'Priced' },
        description: {},
        purchasable: true,
      },
    ];

    const [enriched] = await service.addAdditionalData(products, {
      prices: true,
      variants: false,
      categories: false,
    });

    expect(enriched.id).toBe('prod-priced');
    expect(enriched.price).toBeUndefined();
    expect(getProductPrices).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ productIds: ['prod-priced'] }),
      'Product price lookup failed; continuing without prices',
    );
  });
});
