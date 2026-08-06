import type { Product, ProductSpecification } from '@/platform/services/model/product';
import { hasKeySpecifications, hasLocalizedHighlights, hasTechnicalInformation } from './product-content';

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

/** Shape of `PWC-001`: 12 specs across groups, 2 with `highlight: true`. */
const pwc001FlaggedSpecs: ProductSpecification[] = [
  {
    key: 'capacity',
    label: { en: 'Capacity' },
    value: { en: '100' },
    unit: { en: 'Ah' },
    highlight: true,
  },
  {
    key: 'cycles',
    label: { en: 'Cycles' },
    value: { en: '3000' },
    highlight: true,
  },
  {
    key: 'chemistry',
    label: { en: 'Chemistry' },
    value: { en: 'LiFePO4' },
  },
];

describe('product-content predicates', () => {
  describe('hasKeySpecifications', () => {
    it('returns false for empty variantAttributes, templateAttributes, and specifications', () => {
      expect(
        hasKeySpecifications(
          baseProduct({
            variantAttributes: [],
            templateAttributes: {},
            specifications: [],
          }),
        ),
      ).toBe(false);
    });

    it('returns false when specifications are absent and legacy attributes are empty', () => {
      expect(
        hasKeySpecifications(
          baseProduct({
            variantAttributes: [],
            templateAttributes: {},
          }),
        ),
      ).toBe(false);
    });

    it('returns true for victron-bluesolar-55w shape (one flagged spec)', () => {
      expect(
        hasKeySpecifications(
          baseProduct({
            id: 'victron-bluesolar-55w',
            specifications: victronBluesolarFlaggedSpecs,
            variantAttributes: [],
          }),
        ),
      ).toBe(true);
    });

    it('returns true for PWC-001 shape (two flagged specs)', () => {
      expect(
        hasKeySpecifications(
          baseProduct({
            id: 'PWC-001',
            specifications: pwc001FlaggedSpecs,
            variantAttributes: [],
          }),
        ),
      ).toBe(true);
    });

    it('returns true for non-empty legacy variantAttributes when no flagged specs', () => {
      expect(
        hasKeySpecifications(
          baseProduct({
            specifications: [],
            variantAttributes: [
              {
                key: 'color',
                values: [{ key: 'red', selected: true }],
              },
            ],
          }),
        ),
      ).toBe(true);
    });

    it('returns true for non-empty legacy templateAttributes when no flagged specs', () => {
      expect(
        hasKeySpecifications(
          baseProduct({
            specifications: [],
            templateAttributes: { material: 'steel' },
          }),
        ),
      ).toBe(true);
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
              en: ['SG-Ready', 'IP65', 'Bluetooth'],
            },
          }),
          'en',
        ),
      ).toBe(true);
    });
  });

  describe('hasTechnicalInformation', () => {
    it('returns false for groupedSpecifications: []', () => {
      expect(hasTechnicalInformation(baseProduct({ groupedSpecifications: [] }))).toBe(false);
    });

    it('returns false when groupedSpecifications is absent', () => {
      expect(hasTechnicalInformation(baseProduct())).toBe(false);
    });

    it('returns true when at least one group is present', () => {
      expect(
        hasTechnicalInformation(
          baseProduct({
            groupedSpecifications: [
              {
                groupName: 'General',
                item: [{ label: 'Power', value: '55', unit: 'W' }],
              },
            ],
          }),
        ),
      ).toBe(true);
    });
  });
});
