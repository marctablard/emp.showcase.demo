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

    it('3b. maps template id/version ref from product', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        template: { id: '6a75a5e7a472846eb834f96b', version: 1 },
        mixins: {
          productTemplateAttributes: {
            'required-width': 1705,
          },
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.template).toEqual({ id: '6a75a5e7a472846eb834f96b', version: '1' });
      expect(result.templateAttributes).toEqual({ 'required-width': '1705' });
    });

    it('3c. maps localized labels from expand=template attributes', () => {
      const input = {
        id: 'basic456',
        code: 'basic456',
        productType: 'BASIC',
        template: {
          id: '6a75a5e7a472846eb834f96b',
          metadata: { version: 1 },
          attributes: [
            {
              key: 'pick-a-list-optional',
              name: { en: 'Pick a list (optional)' },
              type: 'TEXT',
              metadata: { mandatory: false, variantAttribute: false },
            },
            {
              key: 'required-width',
              name: { en: 'Required Width' },
              type: 'NUMBER',
              metadata: { mandatory: true, variantAttribute: false },
            },
          ],
        },
        mixins: {
          productTemplateAttributes: {
            'pick-a-list-optional': 'value 4',
            'required-width': 1705,
          },
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.template).toEqual({ id: '6a75a5e7a472846eb834f96b', version: '1' });
      expect(result.templateAttributeLabels).toEqual({
        'pick-a-list-optional': { en: 'Pick a list (optional)' },
        'required-width': { en: 'Required Width' },
      });
      expect(result.templateAttributeTypes).toEqual({
        'pick-a-list-optional': 'TEXT',
        'required-width': 'NUMBER',
      });
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

    it('4b. array-of-arrays highlights mixin maps to both locales', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        mixins: {
          highlights: {
            highlights: [
              [
                { language: 'de', value: 'SG-Ready' },
                { language: 'en', value: 'SG-Ready' },
              ],
              [
                { language: 'de', value: 'Das ist keine Fälschung' },
                { language: 'en', value: 'This is not fake' },
              ],
              [
                { language: 'de', value: 'Energieeffizient' },
                { language: 'en', value: 'Energy efficient' },
              ],
            ],
          },
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.highlights).toEqual({
        de: ['SG-Ready', 'Das ist keine Fälschung', 'Energieeffizient'],
        en: ['SG-Ready', 'This is not fake', 'Energy efficient'],
      });
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

    it('7. passes specifications[].highlight through and keeps all specs in groupedSpecifications', () => {
      const input = {
        id: 'p1',
        code: 'p1',
        productType: 'BASIC',
        mixins: {
          specifications: {
            specifications: [
              {
                key: 'energy',
                group: 'electrical',
                groupLabel: [{ language: 'en', value: 'Electrical' }],
                label: [{ language: 'en', value: 'Energy' }],
                value: [{ language: 'en', value: '55W' }],
                highlight: true,
              },
              {
                key: 'weight',
                group: 'physical',
                groupLabel: [{ language: 'en', value: 'Physical' }],
                label: [{ language: 'en', value: 'Weight' }],
                value: [{ language: 'en', value: '4kg' }],
                highlight: null,
              },
              {
                key: 'color',
                group: 'physical',
                groupLabel: [{ language: 'en', value: 'Physical' }],
                label: [{ language: 'en', value: 'Color' }],
                value: [{ language: 'en', value: 'Black' }],
              },
            ],
          },
        },
      } as any;

      const result = mapper.mapToService(input);

      expect(result.specifications).toHaveLength(3);
      expect(result.specifications?.[0]).toEqual(
        expect.objectContaining({
          key: 'energy',
          highlight: true,
        }),
      );
      expect(result.specifications?.[1]).toEqual(
        expect.objectContaining({
          key: 'weight',
        }),
      );
      expect(result.specifications?.[1]).not.toHaveProperty('highlight');
      expect(result.specifications?.[2]).toEqual(
        expect.objectContaining({
          key: 'color',
        }),
      );
      expect(result.specifications?.[2]).not.toHaveProperty('highlight');

      // R-05 / Task 2.5: Technical Information keeps every specification — do not filter by highlight in the mapper.
      // groupSpecificationsByGroup projects { label, value, unit } only; completeness is by content, not key/highlight.
      const groupedItems = result.groupedSpecifications?.flatMap((group) => group.item) ?? [];
      expect(groupedItems).toHaveLength(3);
      expect(groupedItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: { en: 'Energy' }, value: { en: '55W' } }),
          expect.objectContaining({ label: { en: 'Weight' }, value: { en: '4kg' } }),
          expect.objectContaining({ label: { en: 'Color' }, value: { en: 'Black' } }),
        ]),
      );
      expect(result.groupedSpecifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            groupName: { en: 'Electrical' },
            item: expect.arrayContaining([expect.objectContaining({ label: { en: 'Energy' }, value: { en: '55W' } })]),
          }),
          expect.objectContaining({
            groupName: { en: 'Physical' },
            item: expect.arrayContaining([
              expect.objectContaining({ label: { en: 'Weight' }, value: { en: '4kg' } }),
              expect.objectContaining({ label: { en: 'Color' }, value: { en: 'Black' } }),
            ]),
          }),
        ]),
      );
    });

    it('7. stringifies numeric variant attribute value keys', () => {
      const input = {
        id: 'parent-1',
        code: 'parent-1',
        productType: 'PARENT_VARIANT',
        variantAttributes: {
          width: [{ key: 15 }, { key: 20 }, { key: 100 }],
          height: [{ key: 'Short' }, { key: 'Medium' }, { key: 'Long' }],
        },
        template: {
          id: 'tpl-1',
          attributes: [
            { key: 'width', name: { en: 'width' } },
            { key: 'height', name: { en: 'height' } },
          ],
        },
      } as any;

      const result = mapper.mapToService(input);
      expect(result.variantAttributes).toEqual([
        {
          key: 'width',
          name: { en: 'width' },
          values: [
            { key: '15', selected: false },
            { key: '20', selected: false },
            { key: '100', selected: false },
          ],
        },
        {
          key: 'height',
          name: { en: 'height' },
          values: [
            { key: 'Short', selected: false },
            { key: 'Medium', selected: false },
            { key: 'Long', selected: false },
          ],
        },
      ]);
    });
  });
});
