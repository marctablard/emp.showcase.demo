import type { Product } from '@/platform/services/model/product';
import {
  inferVariantAttributes,
  inferVariantAttributesFromNames,
  inferVariantAttributesFromSpecifications,
  parseVariantNameAttributes,
} from './variant-name-parser';

describe('variant-name-parser', () => {
  const variants: Product[] = [
    { id: 'v1', name: 'K10/100x130x22/1.1730', description: '', purchasable: true },
    { id: 'v2', name: 'K10/100x130x22/1.2085', description: '', purchasable: true },
    { id: 'v3', name: 'K10/095x095x22/1.1730', description: '', purchasable: true },
  ];

  it('parses dimensions and material from HASCO-style names', () => {
    expect(parseVariantNameAttributes('K10/100x130x22/1.1730')).toEqual({
      dimensions: '100x130x22',
      material: '1.1730',
    });
  });

  it('ignores short or non-HASCO names', () => {
    expect(parseVariantNameAttributes('A8005/1/Typ2')).toBeNull();
    expect(parseVariantNameAttributes('A8005/1x1')).toBeNull();
  });

  it('builds attribute definitions for sibling variants', () => {
    const { attributeDefinitions, attributeMaps } = inferVariantAttributesFromNames(variants, 'v1');
    expect(attributeDefinitions).toHaveLength(2);
    expect(attributeMaps.get('v1')).toEqual({
      dimensions: '100x130x22',
      material: '1.1730',
    });
    expect(attributeDefinitions.find((item) => item.key === 'dimensions')?.values).toHaveLength(2);
    expect(attributeDefinitions.find((item) => item.key === 'material')?.values).toHaveLength(2);
  });

  it('infers attributes from highlighted specifications', () => {
    const plugInVariants: Product[] = [
      {
        id: 'a1',
        name: 'A8005/1x1',
        description: '',
        purchasable: true,
        specifications: [
          { key: 'typ1', label: { en: 'Typ1' }, value: { en: '1' }, highlight: true },
          { key: 'typ2', label: { en: 'Typ2' }, value: { en: '1' }, highlight: true },
        ],
      },
      {
        id: 'a2',
        name: 'A8005/1x2',
        description: '',
        purchasable: true,
        specifications: [
          { key: 'typ1', label: { en: 'Typ1' }, value: { en: '1' }, highlight: true },
          { key: 'typ2', label: { en: 'Typ2' }, value: { en: '2' }, highlight: true },
        ],
      },
    ];

    const { attributeDefinitions, attributeMaps } = inferVariantAttributesFromSpecifications(plugInVariants, 'a2');
    expect(attributeDefinitions).toHaveLength(1);
    expect(attributeDefinitions[0].key).toBe('typ2');
    expect(attributeMaps.get('a2')).toEqual({ typ1: '1', typ2: '2' });
  });

  it('prefers HASCO names before specifications', () => {
    const mixed: Product[] = [
      {
        ...variants[0],
        specifications: [{ key: 'typ2', label: { en: 'Typ2' }, value: { en: '1' }, highlight: true }],
      },
    ];
    const { attributeDefinitions } = inferVariantAttributes([mixed[0], variants[1], variants[2]], 'v1');
    expect(attributeDefinitions.some((item) => item.key === 'dimensions')).toBe(true);
  });
});
