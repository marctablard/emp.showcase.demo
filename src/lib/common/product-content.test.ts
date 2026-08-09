import type { Product, ProductSpecification } from '@/platform/services/model/product';
import {
  KEY_SPEC_BASIC_GROUP_ID,
  TECHNICAL_INFO_BASIC_GROUP_ID,
  getKeySpecificationGroups,
  getKeySpecifications,
  getTechnicalInformationGroups,
  hasKeySpecifications,
  hasLocalizedHighlights,
  hasTechnicalInformation,
} from './product-content';

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    name: 'Test',
    description: 'Test description',
    purchasable: true,
    ...overrides,
  };
}

/** Shape of `victron-bluesolar-55w`: 4 specs, 1 with `highlight: true`. */
const victronBluesolarFlaggedSpecs: ProductSpecification[] = [
  {
    key: 'power',
    label: { en: 'Power' },
    value: { en: '55' },
    unit: { en: 'W' },
    highlight: true,
  },
  {
    key: 'voltage',
    label: { en: 'Voltage' },
    value: { en: '12' },
    unit: { en: 'V' },
  },
  {
    key: 'weight',
    label: { en: 'Weight' },
    value: { en: '4.3' },
    unit: { en: 'kg' },
  },
  {
    key: 'dimensions',
    label: { en: 'Dimensions' },
    value: { en: '350 x 200' },
    unit: { en: 'mm' },
  },
];

describe('product-content predicates', () => {
  describe('getKeySpecificationGroups / hasKeySpecifications', () => {
    it('returns empty when no flagged specs and no templateAttributes', () => {
      expect(
        getKeySpecificationGroups(
          baseProduct({
            specifications: victronBluesolarFlaggedSpecs.map((spec) =>
              spec.key === 'power' ? { ...spec, highlight: false } : spec,
            ),
            templateAttributes: {},
          }),
        ),
      ).toEqual([]);
      expect(hasKeySpecifications(baseProduct())).toBe(false);
    });

    it('includes only highlight:true specs', () => {
      const product = baseProduct({
        id: 'victron-bluesolar-55w',
        specifications: victronBluesolarFlaggedSpecs,
      });
      expect(getKeySpecifications(product)).toEqual([victronBluesolarFlaggedSpecs[0]]);
      expect(hasKeySpecifications(product)).toBe(true);
    });

    it('groups flagged specs when they span more than one group', () => {
      const product = baseProduct({
        specifications: [
          {
            key: 'power',
            group: 'electrical',
            groupLabel: { en: 'Electrical' },
            label: { en: 'Power' },
            value: { en: '55' },
            highlight: true,
          },
          {
            key: 'weight',
            group: 'physical',
            groupLabel: { en: 'Physical' },
            label: { en: 'Weight' },
            value: { en: '4.3' },
            highlight: true,
          },
        ],
      });

      expect(getKeySpecificationGroups(product)).toEqual([
        {
          id: 'electrical',
          groupName: { en: 'Electrical' },
          items: [product.specifications![0]],
        },
        {
          id: 'physical',
          groupName: { en: 'Physical' },
          items: [product.specifications![1]],
        },
      ]);
    });

    it('appends templateAttributes as Basic Specifications', () => {
      const product = baseProduct({
        specifications: [victronBluesolarFlaggedSpecs[0]],
        templateAttributes: { length: '167', width: '181' },
        templateAttributeLabels: {
          length: { en: 'Length (m)', de: 'Länge (m)' },
          width: { en: 'Width' },
        },
      });

      const groups = getKeySpecificationGroups(product);
      expect(groups).toHaveLength(2);
      expect(groups[1]).toEqual({
        id: KEY_SPEC_BASIC_GROUP_ID,
        groupName: KEY_SPEC_BASIC_GROUP_ID,
        items: [
          { key: 'template-length', label: { en: 'Length (m)', de: 'Länge (m)' }, value: { en: '167' } },
          { key: 'template-width', label: { en: 'Width' }, value: { en: '181' } },
        ],
      });
    });

    it('orders Basic Specifications by templateAttributeOrder, not A–Z', () => {
      const product = baseProduct({
        templateAttributes: {
          zebra: 'z',
          alpha: 'a',
          middle: 'm',
        },
        templateAttributeOrder: ['middle', 'zebra', 'alpha'],
      });

      expect(getKeySpecificationGroups(product)[0].items.map((item) => item.key)).toEqual([
        'template-middle',
        'template-zebra',
        'template-alpha',
      ]);
    });

    it('falls back to attribute key when templateAttributeLabels are missing', () => {
      const product = baseProduct({
        templateAttributes: { 'required-width': '1705' },
      });

      expect(getKeySpecificationGroups(product)[0].items[0].label).toEqual({ en: 'required-width' });
    });

    it('does not fall back to unflagged specs or variantAttributes', () => {
      expect(
        hasKeySpecifications(
          baseProduct({
            specifications: [
              {
                key: 'capacity',
                label: { en: 'Capacity' },
                value: { en: '60 Ah' },
                highlight: false,
              },
            ],
            groupedSpecifications: [
              {
                groupName: { en: 'Specifications' },
                item: [{ label: { en: 'Model' }, value: { en: 'X' }, unit: '' }],
              },
            ],
            variantAttributes: [
              {
                key: 'color',
                values: [{ key: 'red', selected: true }],
              },
            ],
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getTechnicalInformationGroups / hasTechnicalInformation', () => {
    it('returns false when groupedSpecifications and templateAttributes are empty', () => {
      expect(hasTechnicalInformation(baseProduct({ groupedSpecifications: [] }))).toBe(false);
      expect(hasTechnicalInformation(baseProduct())).toBe(false);
    });

    it('prepends Basic Attributes from templateAttributes before grouped specs', () => {
      const product = baseProduct({
        templateAttributes: { length: '167' },
        templateAttributeLabels: { length: { en: 'Length', de: 'Länge' } },
        groupedSpecifications: [
          {
            groupName: { en: 'Specifications', de: 'Specifications' },
            item: [
              {
                label: { en: 'Model', de: 'Model' },
                value: { en: 'LiFePO4', de: 'LiFePO4' },
                unit: '',
              },
            ],
          },
        ],
      });

      expect(getTechnicalInformationGroups(product)).toEqual([
        {
          groupName: TECHNICAL_INFO_BASIC_GROUP_ID,
          item: [
            {
              label: { en: 'Length', de: 'Länge' },
              value: { en: '167' },
              unit: '',
              attributeKey: 'length',
            },
          ],
        },
        product.groupedSpecifications![0],
      ]);
      expect(hasTechnicalInformation(product)).toBe(true);
    });

    it('shows Basic Attributes alone when only templateAttributes exist', () => {
      expect(getTechnicalInformationGroups(baseProduct({ templateAttributes: { material: 'steel' } }))).toEqual([
        {
          groupName: TECHNICAL_INFO_BASIC_GROUP_ID,
          item: [{ label: { en: 'material' }, value: { en: 'steel' }, unit: '', attributeKey: 'material' }],
        },
      ]);
    });

    it('orders Basic Attributes by templateAttributeOrder, not A–Z', () => {
      const product = baseProduct({
        templateAttributes: {
          zebra: 'z',
          alpha: 'a',
          middle: 'm',
        },
        templateAttributeOrder: ['middle', 'zebra', 'alpha'],
      });

      expect(getTechnicalInformationGroups(product)[0].item.map((item) => item.attributeKey)).toEqual([
        'middle',
        'zebra',
        'alpha',
      ]);
    });
  });

  describe('hasLocalizedHighlights', () => {
    it('returns false when highlights is { en: [] }', () => {
      expect(hasLocalizedHighlights(baseProduct({ highlights: { en: [] } }), 'en')).toBe(false);
    });

    it('returns false when highlights is absent', () => {
      expect(hasLocalizedHighlights(baseProduct(), 'en')).toBe(false);
    });

    it('returns false for a locale with no entries even when another locale has some', () => {
      expect(
        hasLocalizedHighlights(
          baseProduct({
            highlights: {
              en: ['SG-Ready', 'IP65'],
              de: [],
            },
          }),
          'de',
        ),
      ).toBe(false);
    });

    it('returns true when the requested locale has entries', () => {
      expect(
        hasLocalizedHighlights(
          baseProduct({
            highlights: {
              en: ['SG-Ready'],
            },
          }),
          'en',
        ),
      ).toBe(true);
    });
  });
});
