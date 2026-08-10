import type { Product } from '@/platform/services/model/product';
import EmporixProductService from './EmporixProductService';

describe('EmporixProductService template meta enrichment', () => {
  function createService(overrides?: {
    searchProducts?: jest.Mock;
    getProductTemplate?: jest.Mock;
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

    return new EmporixProductService(
      { getProductPrices: jest.fn().mockResolvedValue(new Map()) } as never,
      { mapToService: jest.fn() } as never,
      { searchProducts, getProduct: jest.fn() } as never,
      { getBrand: jest.fn() } as never,
      { getLabels: jest.fn(), getLabel: jest.fn() } as never,
      { getProductTemplate } as never,
      { getCategoriesForProduct: jest.fn() } as never,
      { filterByCustomerSegments: jest.fn(async (items: unknown) => items) } as never,
      { getCurrent: jest.fn().mockResolvedValue(null) } as never,
    );
  }

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
        criteria: { id: '(prod-1)' },
        expand: ['template'],
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
        purchasable: true,
        template: { id: 'tmpl-1' },
        templateAttributes: { 'pick-a-list-optional': 'Value 4' },
      },
    ];

    await service.addAdditionalData(products, { prices: false, variants: false, categories: false });

    expect(searchProducts).not.toHaveBeenCalled();
    expect(getProductTemplate).toHaveBeenCalledWith('tmpl-1', undefined);
  });
});
