import type { Product } from '@/platform/services/model/product';
import {
  buildFilteredAttributeValues,
  filterVariantsBySelection,
  getDefaultSelectedAttributes,
  getVariantAttributeMap,
  isVariantConfiguratorProduct,
} from './variant-configurator';

function createVariant(id: string, attributes: Record<string, string>): Product {
  return {
    id,
    name: id,
    description: '',
    purchasable: true,
    variantAttributes: Object.entries(attributes).map(([key, value]) => ({
      key,
      values: [{ key: value, selected: true }],
    })),
  };
}

describe('variant-configurator', () => {
  const variants = [
    createVariant('v1', { length: '100', material: '1730' }),
    createVariant('v2', { length: '100', material: '2085' }),
    createVariant('v3', { length: '125', material: '1730' }),
  ];

  it('extracts selected attributes from a variant product', () => {
    expect(getVariantAttributeMap(variants[0])).toEqual({ length: '100', material: '1730' });
  });

  it('preselects attributes for a variant product', () => {
    expect(getDefaultSelectedAttributes(variants[1])).toEqual({ length: '100', material: '2085' });
  });

  it('ignores non-configurable values stored on the product', () => {
    const product: Product = {
      id: 'a1',
      name: 'A8005/1x1',
      description: '',
      purchasable: true,
      variantAttributes: [{ key: 'typ2', values: [{ key: '1', selected: true }] }],
      variantAttributeValues: { typ1: '1', typ2: '1' },
    };

    expect(getDefaultSelectedAttributes(product)).toEqual({ typ2: '1' });
  });

  it('filters variants by partial chip selection', () => {
    expect(filterVariantsBySelection(variants, { length: '100' })).toHaveLength(2);
    expect(filterVariantsBySelection(variants, { length: '100', material: '1730' })).toHaveLength(1);
  });

  it('limits chip options based on other selected attributes', () => {
    const available = {
      length: new Set(['100', '125']),
      material: new Set(['1730', '2085']),
    };

    const filtered = buildFilteredAttributeValues(variants, { length: '100' }, available);
    expect(Array.from(filtered.material)).toEqual(['1730', '2085']);
    expect(Array.from(filtered.length)).toEqual(['100', '125']);
  });
});

describe('isVariantConfiguratorProduct', () => {
  it('returns false for BASIC and BUNDLE products', () => {
    expect(
      isVariantConfiguratorProduct({
        id: 'imp-basic-tool',
        productType: 'BASIC',
      }),
    ).toBe(false);
    expect(
      isVariantConfiguratorProduct({
        id: 'imp-starter-bundle',
        productType: 'BUNDLE',
      }),
    ).toBe(false);
  });

  it('returns true for dynamic variant families', () => {
    expect(
      isVariantConfiguratorProduct({
        id: 'K10-Mat-10081',
        productType: 'DYNAMIC_VARIANT',
        parentVariantId: 'K10-Mat',
      }),
    ).toBe(true);
  });

  it('returns false for classic parent variant products with template attributes', () => {
    expect(
      isVariantConfiguratorProduct({
        id: 'parent-1',
        productType: 'PARENT_VARIANT',
        variantAttributes: [{ key: 'color', values: [{ key: 'red', selected: false }] }],
      }),
    ).toBe(false);
  });
});
