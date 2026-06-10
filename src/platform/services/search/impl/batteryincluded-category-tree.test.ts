import { buildBatteryIncludedCategoryTree } from './batteryincluded-category-tree';

describe('buildBatteryIncludedCategoryTree', () => {
  it('builds a BI tree from breadcrumb rows filtered by published roots and ordered by published root order', () => {
    const response = {
      hits: [],
      found: 0,
      page: 0,
      size: 0,
      facet_counts: [
        {
          field_name: '_product_i18n.categories.breadcrumbs.displayPath',
          type: 'select',
          stats: { total_values: 3 },
          counts: [
            {
              count: 4,
              value: 'Power Tools > Drills',
              data: {
                displayPath: 'Power Tools > Drills',
                idPath: 'root-b > child-b',
              },
            },
            {
              count: 2,
              value: 'Cables > USB-C',
              data: {
                displayPath: 'Cables > USB-C',
                idPath: 'root-a > child-a',
              },
            },
            {
              count: 1,
              value: 'Hidden > Orphan',
              data: {
                displayPath: 'Hidden > Orphan',
                idPath: 'hidden-root > hidden-child',
              },
            },
          ],
        },
        {
          field_name: '_product_i18n.categories.hierarchy.id',
          type: 'select',
          stats: { total_values: 4 },
          counts: [
            { count: 1, value: 'root-a' },
            { count: 1, value: 'child-a' },
            { count: 1, value: 'root-b' },
            { count: 1, value: 'child-b' },
          ],
        },
      ],
    };

    const result = buildBatteryIncludedCategoryTree(
      response,
      ['root-a', 'root-b'],
      'en',
      '_product_i18n.categories.breadcrumbs.displayPath',
    );

    expect(result.snapshot?.roots.map((root) => root.id)).toEqual(['root-a', 'root-b']);
    expect(result.snapshot?.byId['child-a']).toMatchObject({
      facetValue: 'Cables > USB-C',
      publicationAnchorId: 'root-a',
      leafLabel: 'USB-C',
    });
    expect(result.snapshot?.countsById['root-a']).toBe(2);
    expect(result.snapshot?.countsById['root-b']).toBe(4);
    expect(result.discardedRows).toContain('Hidden > Orphan');
  });

  it('returns null when the breadcrumb facet is missing', () => {
    const result = buildBatteryIncludedCategoryTree(
      {
        hits: [],
        found: 0,
        page: 0,
        size: 0,
        facet_counts: [],
      },
      ['root-a'],
      'en',
      '_product_i18n.categories.breadcrumbs.displayPath',
    );

    expect(result.snapshot).toBeNull();
  });
});
