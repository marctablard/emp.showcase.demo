import { EmporixProduct } from '@/platform/integrations/emporix/model/product';
import { EmporixProductMapper } from './EmporixProductMapper';

describe('EmporixProductMapper', () => {
  let mapper: EmporixProductMapper;

  beforeEach(() => {
    mapper = new EmporixProductMapper();
  });

  describe('mapToService', () => {
    it('1. maps groupLabel as a plain string to a localized object', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        mixins: {
          specifications: {
            specifications: [
              {
                groupLabel: 'General Information',
              },
            ],
          },
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.specifications?.[0].groupLabel).toEqual({ en: 'General Information' });
    });

    it('2. spec containing ONLY groupLabel does not throw and produces a spec entry', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        mixins: {
          specifications: {
            specifications: [
              {
                groupLabel: 'Just a label',
              },
            ],
          },
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.specifications).toHaveLength(1);
      expect(result.specifications?.[0]).toEqual(
        expect.objectContaining({
          key: '',
          label: { en: '' },
          value: { en: '' },
          groupLabel: { en: 'Just a label' },
        }),
      );
    });

    it('3. product with NO mixins at all does not throw', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
      } as any;

      const result = mapper.mapToService(input);
      expect(result.specifications).toEqual([]);
      expect(result.highlights).toBeUndefined();
      expect(result.variantAttributeValues).toBeUndefined();
      expect(result.templateAttributes).toBeUndefined();
    });

    it('4. missing highlights, specifications, and productVariantAttributes individually do not throw and yield empty/undefined', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        mixins: {},
      } as any;

      const result = mapper.mapToService(input);
      expect(result.highlights).toBeUndefined();
      expect(result.specifications).toEqual([]);
      expect(result.variantAttributeValues).toBeUndefined();
    });

    it('5. unknown/custom variant attribute key is mapped', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        mixins: {
          productVariantAttributes: {
            'custom-attr': 'custom-value',
          },
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.variantAttributeValues).toEqual({
        'custom-attr': 'custom-value',
      });
    });

    it('6. realistic array-shaped spec maps to localized objects', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        mixins: {
          specifications: {
            specifications: [
              {
                key: 'width',
                label: [{ language: 'en', value: 'Width' }],
                value: [{ language: 'en', value: '40' }],
              },
            ],
          },
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.specifications?.[0]).toEqual(
        expect.objectContaining({
          key: 'width',
          label: { en: 'Width' },
          value: { en: '40' },
        }),
      );
    });
  });
});
