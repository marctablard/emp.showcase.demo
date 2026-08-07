import type { Product } from '@/platform/services/model/product';
import {
  collectVariantAttributeGroups,
  getCompatibleAttributeValues,
  getSelectedVariantAttributeValues,
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
