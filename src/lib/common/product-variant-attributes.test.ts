import type { Product } from '@/platform/services/model/product';
import {
  collectVariantAttributeGroups,
  getCompatibleAttributeValues,
  getFirstVariantAttributeGroupFromChildren,
  getSelectedVariantAttributeValues,
  isVariantFamilyProduct,
} from './product-variant-attributes';

function buildVariant(id: string, attributes: { key: string; value: string; name?: string }[]): Product {
  return {
    id,
    name: id,
    description: '',
    purchasable: true,
    variantAttributes: attributes.map((attribute) => ({
      key: attribute.key,
      name: attribute.name,
      values: [
        { key: attribute.value, selected: true },
        { key: 'other', selected: false },
      ],
    })),
  };
}

describe('collectVariantAttributeGroups', () => {
  it('collects unique selected values from variants ordered by parent attributes', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
      variantAttributes: [
        { key: 'capacity', name: 'Capacity', values: [] },
        { key: 'voltage', name: 'Voltage', values: [] },
      ],
    };
    const variants = [
      buildVariant('v1', [
        { key: 'capacity', value: '12 Ah', name: 'Capacity' },
        { key: 'voltage', value: '12 V', name: 'Voltage' },
      ]),
      buildVariant('v2', [
        { key: 'capacity', value: '60 Ah', name: 'Capacity' },
        { key: 'voltage', value: '12 V', name: 'Voltage' },
      ]),
      buildVariant('v3', [
        { key: 'capacity', value: '12 Ah', name: 'Capacity' },
        { key: 'voltage', value: '24 V', name: 'Voltage' },
      ]),
    ];

    expect(collectVariantAttributeGroups(parent, variants)).toEqual([
      { key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] },
      { key: 'voltage', name: 'Voltage', values: ['12 V', '24 V'] },
    ]);
  });

  it('stringifies numeric and boolean parent catalog value keys for display', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
      variantAttributes: [
        {
          key: 'width',
          name: { en: 'width' },
          // Runtime Emporix payloads may send numbers before mapper coercion.
          values: [
            { key: 15 as unknown as string, selected: true },
            { key: 20 as unknown as string, selected: false },
            { key: 100 as unknown as string, selected: false },
          ],
        },
        {
          key: 'height',
          name: { en: 'height' },
          values: [
            { key: 'Short', selected: false },
            { key: 'Medium', selected: true },
            { key: 'Long', selected: false },
          ],
        },
      ],
    };

    expect(collectVariantAttributeGroups(parent, [])).toEqual([
      { key: 'width', name: { en: 'width' }, values: ['15', '20', '100'] },
      { key: 'height', name: { en: 'height' }, values: ['Short', 'Medium', 'Long'] },
    ]);
  });

  it('collects unique selected values when the parent has no variantAttributes', () => {
    const parent: Product = {
      id: 'SLP654321',
      name: 'Victron Solar panel',
      description: '',
      purchasable: false,
      isParentVariant: true,
      variantAttributes: [],
    };
    const variants = [
      {
        ...buildVariant('child-1200', [{ key: 'nominal-power', value: '1200W', name: 'nominal-power' }]),
        variantAttributeValues: { 'nominal-power': '1200W' },
      },
      {
        ...buildVariant('child-600', [{ key: 'nominal-power', value: '600W', name: 'nominal-power' }]),
        variantAttributeValues: { 'nominal-power': '600W' },
      },
    ];

    expect(collectVariantAttributeGroups(parent, variants)).toEqual([
      { key: 'nominal-power', name: 'nominal-power', values: ['1200W', '600W'] },
    ]);
  });

  it('collects unique values from variantAttributeValues when selected flags are missing', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
      variantAttributes: [],
    };
    const variants: Product[] = [
      {
        id: 'v1',
        name: 'v1',
        description: '',
        purchasable: true,
        variantAttributeValues: { 'nominal-power': '600W' },
      },
      {
        id: 'v2',
        name: 'v2',
        description: '',
        purchasable: true,
        variantAttributeValues: { 'nominal-power': '1200W' },
      },
      {
        id: 'v3',
        name: 'v3',
        description: '',
        purchasable: true,
        variantAttributeValues: { 'nominal-power': '600W' },
      },
    ];

    expect(collectVariantAttributeGroups(parent, variants)).toEqual([
      { key: 'nominal-power', values: ['600W', '1200W'] },
    ]);
  });

  it('falls back to parent value catalog when variants have no attributes', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
      variantAttributes: [
        {
          key: 'capacity',
          name: 'Capacity',
          values: [
            { key: '12 Ah', selected: true },
            { key: '60 Ah', selected: false },
          ],
        },
      ],
    };
    const variants: Product[] = [{ id: 'v1', name: 'v1', description: '', purchasable: true }];

    expect(collectVariantAttributeGroups(parent, variants)).toEqual([
      { key: 'capacity', name: 'Capacity', values: ['12 Ah', '60 Ah'] },
    ]);
  });
});

describe('getSelectedVariantAttributeValues', () => {
  it('returns selected value keys by attribute', () => {
    const variant = buildVariant('v1', [
      { key: 'capacity', value: '12 Ah' },
      { key: 'voltage', value: '24 V' },
    ]);

    expect(getSelectedVariantAttributeValues(variant)).toEqual({
      capacity: '12 Ah',
      voltage: '24 V',
    });
  });

  it('fills missing keys from variantAttributeValues', () => {
    const variant: Product = {
      id: 'v1',
      name: 'v1',
      description: '',
      purchasable: true,
      variantAttributeValues: { 'nominal-power': '600W' },
    };

    expect(getSelectedVariantAttributeValues(variant)).toEqual({
      'nominal-power': '600W',
    });
  });
});

describe('getFirstVariantAttributeGroupFromChildren', () => {
  it('returns the first unique child attribute group', () => {
    const product: Product = {
      id: 'SLP654321',
      name: 'Victron Solar panel',
      description: '',
      purchasable: false,
      isParentVariant: true,
      variantAttributes: [],
      variants: [
        {
          ...buildVariant('child-1200', [{ key: 'nominal-power', value: '1200W' }]),
          variantAttributeValues: { 'nominal-power': '1200W' },
        },
        {
          ...buildVariant('child-600', [{ key: 'nominal-power', value: '600W' }]),
          variantAttributeValues: { 'nominal-power': '600W' },
        },
      ],
    };

    expect(getFirstVariantAttributeGroupFromChildren(product)).toEqual({
      key: 'nominal-power',
      values: ['1200W', '600W'],
    });
  });

  it('returns undefined when the parent has no child variants', () => {
    expect(
      getFirstVariantAttributeGroupFromChildren({
        id: 'parent',
        name: 'Parent',
        description: '',
        purchasable: false,
        variantAttributes: [],
      }),
    ).toBeUndefined();
  });
});

describe('isVariantFamilyProduct', () => {
  it('treats parent variants with empty attribute catalogs as a family', () => {
    expect(
      isVariantFamilyProduct({
        id: 'SLP654321',
        name: 'Victron Solar panel',
        description: '',
        purchasable: false,
        isParentVariant: true,
        variantAttributes: [],
      }),
    ).toBe(true);
  });

  it('ignores simple products with an empty attribute catalog', () => {
    expect(
      isVariantFamilyProduct({
        id: 'simple-1',
        name: 'Cable',
        description: '',
        purchasable: true,
        variantAttributes: [],
      }),
    ).toBe(false);
  });
});

describe('getCompatibleAttributeValues', () => {
  const variants = [
    buildVariant('v1', [
      { key: 'capacity', value: '12 Ah' },
      { key: 'voltage', value: '12 V' },
    ]),
    buildVariant('v2', [
      { key: 'capacity', value: '60 Ah' },
      { key: 'voltage', value: '12 V' },
    ]),
    buildVariant('v3', [
      { key: 'capacity', value: '12 Ah' },
      { key: 'voltage', value: '24 V' },
    ]),
  ];

  it('keeps values that exist with the other selected axes', () => {
    expect(
      [...getCompatibleAttributeValues(variants, { capacity: '12 Ah', voltage: '12 V' }, 'capacity')].sort(),
    ).toEqual(['12 Ah', '60 Ah']);
  });

  it('excludes values that cannot combine with the current selection', () => {
    expect(
      [...getCompatibleAttributeValues(variants, { capacity: '60 Ah', voltage: '12 V' }, 'voltage')].sort(),
    ).toEqual(['12 V']);
  });
});
