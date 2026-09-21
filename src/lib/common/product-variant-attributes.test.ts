import type { Product } from '@/platform/services/model/product';
import {
  collectVariantAttributeGroups,
  collectVariantAttributeKeys,
  getCompatibleAttributeValues,
  getFirstVariantAttributeGroupFromChildren,
  getSelectedVariantAttributeValues,
  getUnselectedVariantAttributePairs,
  getVariantAttributeDisplayPairs,
  isVariantFamilyProduct,
  sortKeysByTemplateAttributeOrder,
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
  it('prefers a real localized name over a key-echo name', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
      variantAttributes: [{ key: 'width', name: { en: 'width' }, values: [] }],
    };
    const variants = [buildVariant('v1', [{ key: 'width', value: '20', name: 'Width' }])];

    expect(collectVariantAttributeGroups(parent, variants)).toEqual([{ key: 'width', name: 'Width', values: ['20'] }]);
  });

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

  it('orders groups by templateAttributeOrder, then first-seen keys', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
      templateAttributeOrder: ['width', 'yes', 'date-attribute', 'height'],
    };
    const variants = [
      buildVariant('v1', [
        { key: 'height', value: 'Short' },
        { key: 'width', value: '15' },
        { key: 'date-attribute', value: '2026-08-27T09:05:45.279Z' },
      ]),
    ];

    expect(collectVariantAttributeGroups(parent, variants).map((group) => group.key)).toEqual([
      'width',
      'date-attribute',
      'height',
    ]);
  });

  it('includes the current product mixin when it is missing from the fetched variant page', () => {
    const current: Product = {
      id: 'testproduct08272--31ebd504-76e5-4c35-85bb-f30ee68baead',
      name: 'current',
      description: '',
      purchasable: true,
      parentVariantId: 'testproduct08272',
      variantAttributeValues: { 'a-number-attribute-9': '2342423' },
    };
    const variants: Product[] = [
      {
        id: 'other',
        name: 'other',
        description: '',
        purchasable: true,
        variantAttributeValues: { 'a-number-attribute-9': '0' },
        variantAttributes: [
          {
            key: 'a-number-attribute-9',
            values: [
              { key: '0', selected: true },
              { key: '2342423', selected: false },
            ],
          },
        ],
      },
    ];

    expect(
      collectVariantAttributeGroups(current, variants).map((group) => ({
        key: group.key,
        values: [...group.values].sort(),
      })),
    ).toEqual([{ key: 'a-number-attribute-9', values: ['0', '2342423'] }]);
  });

  it('ignores catalog selected NUMBER 0 when the mixin has the real value', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
    };
    const variants: Product[] = [
      {
        id: 'child',
        name: 'child',
        description: '',
        purchasable: true,
        variantAttributeValues: { 'a-number-attribute-9': '2342423' },
        variantAttributes: [
          {
            key: 'a-number-attribute-9',
            name: { en: 'A number attribute 9️⃣' },
            values: [
              { key: '0', selected: true },
              { key: '2342423', selected: false },
            ],
          },
        ],
      },
    ];

    expect(collectVariantAttributeGroups(parent, variants)).toEqual([
      {
        key: 'a-number-attribute-9',
        name: { en: 'A number attribute 9️⃣' },
        values: ['2342423'],
      },
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

  it('prefers mixin NUMBER 2342423 over a catalog selected 0', () => {
    const variant: Product = {
      id: 'v1',
      name: 'v1',
      description: '',
      purchasable: true,
      variantAttributeValues: { 'a-number-attribute-9': '2342423' },
      variantAttributes: [
        {
          key: 'a-number-attribute-9',
          values: [
            { key: '0', selected: true },
            { key: '2342423', selected: false },
          ],
        },
      ],
    };

    expect(getSelectedVariantAttributeValues(variant)).toEqual({
      'a-number-attribute-9': '2342423',
    });
  });
});

describe('sortKeysByTemplateAttributeOrder', () => {
  it('keeps template order and appends unknown keys in first-seen order', () => {
    expect(
      sortKeysByTemplateAttributeOrder(
        ['height', 'width', 'extra', 'date-attribute'],
        ['width', 'yes', 'date-attribute', 'a-number-attribute-9', 'height'],
      ),
    ).toEqual(['width', 'date-attribute', 'height', 'extra']);
  });
});

describe('collectVariantAttributeKeys', () => {
  it('uses child variant keys in template order and skips template-only attributes', () => {
    const parent: Product = {
      id: 'parent',
      name: 'Parent',
      description: '',
      purchasable: false,
      isParentVariant: true,
      variantAttributes: [],
      templateAttributeOrder: [
        'width',
        'yes',
        'date-attribute',
        'a-number-attribute-9',
        'a-very-long-attribute-name-to-test-wrapping',
        'height',
      ],
      variants: [
        {
          ...buildVariant('child', [
            { key: 'a-number-attribute-9', value: '2342423' },
            { key: 'height', value: 'Short' },
            { key: 'width', value: '15' },
            { key: 'date-attribute', value: '2026-08-27T09:05:45.279Z' },
            { key: 'a-very-long-attribute-name-to-test-wrapping', value: 'First option' },
          ]),
          variantAttributeValues: {
            'a-number-attribute-9': '2342423',
            height: 'Short',
            width: '15',
            'date-attribute': '2026-08-27T09:05:45.279Z',
            'a-very-long-attribute-name-to-test-wrapping': 'First option',
          },
        },
      ],
    };

    expect(collectVariantAttributeKeys(parent, parent.variants ?? [])).toEqual([
      'width',
      'date-attribute',
      'a-number-attribute-9',
      'a-very-long-attribute-name-to-test-wrapping',
      'height',
    ]);
  });
});

describe('getVariantAttributeDisplayPairs', () => {
  it('returns mixin-first pairs in templateAttributeOrder', () => {
    const variant: Product = {
      id: 'child',
      name: 'child',
      description: '',
      purchasable: true,
      templateAttributeOrder: ['width', 'yes', 'date-attribute', 'a-number-attribute-9', 'height'],
      variantAttributeValues: {
        height: 'Short',
        width: '15',
        'a-number-attribute-9': '2342423',
        'date-attribute': '2026-08-27T09:05:45.279Z',
      },
      variantAttributes: [
        {
          key: 'a-number-attribute-9',
          name: { en: 'A number attribute 9️⃣' },
          values: [
            { key: '0', selected: true },
            { key: '2342423', selected: false },
          ],
        },
      ],
    };

    expect(getVariantAttributeDisplayPairs(variant)).toEqual([
      { key: 'width', value: '15' },
      { key: 'date-attribute', value: '2026-08-27T09:05:45.279Z' },
      { key: 'a-number-attribute-9', name: { en: 'A number attribute 9️⃣' }, value: '2342423' },
      { key: 'height', value: 'Short' },
    ]);
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

  it('treats DYNAMIC_VARIANT as a family without classic parent flags', () => {
    expect(
      isVariantFamilyProduct({
        id: 'dyn-root',
        name: 'Dynamic root',
        description: '',
        purchasable: false,
        productType: 'DYNAMIC_VARIANT',
        sellable: false,
        parentVariantPath: [],
      }),
    ).toBe(true);
  });
});

describe('getUnselectedVariantAttributePairs', () => {
  it('omits axes the shopper already selected and keeps the remaining pairs', () => {
    const variant = buildVariant('leaf', [
      { key: 'width', value: '15', name: 'Width' },
      { key: 'height', value: 'Short', name: 'Height' },
      { key: 'frequency', value: '50Hz', name: 'Frequency' },
    ]);

    expect(getUnselectedVariantAttributePairs(variant, { width: '15' })).toEqual([
      { key: 'height', name: 'Height', value: 'Short' },
      { key: 'frequency', name: 'Frequency', value: '50Hz' },
    ]);
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
