import { getCategoryChildren } from '@/lib/category/category-tree-utils';
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
          type: 'select' as const,
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
          field_name: '_product.categoryIds',
          type: 'select' as const,
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
      displayPath: 'Cables > USB-C',
      facetValue: 'Cables > USB-C',
      publicationAnchorId: 'root-a',
      leafLabel: 'USB-C',
    });
    expect(result.snapshot?.countsById['root-a']).toBe(2);
    expect(result.snapshot?.countsById['root-b']).toBe(4);
    expect(result.discardedRows).toContain('Hidden > Orphan');
  });

  it('preserves the full breadcrumb depth when BI returns progressively deeper category rows', () => {
    const response = {
      hits: [],
      found: 1,
      page: 1,
      size: 24,
      facet_counts: [
        {
          field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
          type: 'select' as const,
          stats: { total_values: 7 },
          counts: [
            {
              count: 1,
              value: 'zRoot Two',
              data: {
                displayPath: 'zRoot Two',
                idPath: 'root',
              },
            },
            {
              count: 1,
              value: 'zRoot Two > rt-child1',
              data: {
                displayPath: 'zRoot Two > rt-child1',
                idPath: 'root > child-1',
              },
            },
            {
              count: 1,
              value: 'zRoot Two > rt-child1 > rt-child11',
              data: {
                displayPath: 'zRoot Two > rt-child1 > rt-child11',
                idPath: 'root > child-1 > child-11',
              },
            },
            {
              count: 1,
              value: 'zRoot Two > rt-child1 > rt-child11 > rt-child111',
              data: {
                displayPath: 'zRoot Two > rt-child1 > rt-child11 > rt-child111',
                idPath: 'root > child-1 > child-11 > child-111',
              },
            },
            {
              count: 1,
              value: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111',
              data: {
                displayPath: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111',
                idPath: 'root > child-1 > child-11 > child-111 > child-1111',
              },
            },
            {
              count: 1,
              value: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111 > rt-child11111',
              data: {
                displayPath: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111 > rt-child11111',
                idPath: 'root > child-1 > child-11 > child-111 > child-1111 > child-11111',
              },
            },
            {
              count: 1,
              value: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111 > rt-child11111 > rt-child111112',
              data: {
                displayPath:
                  'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111 > rt-child11111 > rt-child111112',
                idPath: 'root > child-1 > child-11 > child-111 > child-1111 > child-11111 > child-111112',
              },
            },
          ],
        },
        {
          field_name: '_product.categoryIds',
          type: 'select' as const,
          stats: { total_values: 7 },
          counts: [
            { count: 1, value: 'root' },
            { count: 1, value: 'child-1' },
            { count: 1, value: 'child-11' },
            { count: 1, value: 'child-111' },
            { count: 1, value: 'child-1111' },
            { count: 1, value: 'child-11111' },
            { count: 1, value: 'child-111112' },
          ],
        },
      ],
    };

    const result = buildBatteryIncludedCategoryTree(
      response,
      ['root'],
      'en',
      '_product_i18n.categoryBreadcrumbs.displayPath',
    );
    const root = result.snapshot?.roots[0];
    const child1 = root ? getCategoryChildren(root)[0] : undefined;
    const child11 = child1 ? getCategoryChildren(child1)[0] : undefined;
    const child111 = child11 ? getCategoryChildren(child11)[0] : undefined;
    const child1111 = child111 ? getCategoryChildren(child111)[0] : undefined;
    const child11111 = child1111 ? getCategoryChildren(child1111)[0] : undefined;
    const child111112 = child11111 ? getCategoryChildren(child11111)[0] : undefined;

    expect(root?.id).toBe('root');
    expect(result.snapshot?.byId['child-111112']).toMatchObject({
      displayPath: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111 > rt-child11111 > rt-child111112',
      facetValue: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111 > rt-child11111 > rt-child111112',
      labelPath: 'zRoot Two > rt-child1 > rt-child11 > rt-child111 > rt-child1111 > rt-child11111 > rt-child111112',
      idPath: ['root', 'child-1', 'child-11', 'child-111', 'child-1111', 'child-11111', 'child-111112'],
    });
    expect(child1).toMatchObject({ id: 'child-1' });
    expect(child11).toMatchObject({ id: 'child-11' });
    expect(child111).toMatchObject({ id: 'child-111' });
    expect(child1111).toMatchObject({ id: 'child-1111' });
    expect(child11111).toMatchObject({ id: 'child-11111' });
    expect(child111112).toMatchObject({ id: 'child-111112' });
  });

  it('sorts roots and siblings by the breadcrumb position of each row leaf', () => {
    const response = {
      hits: [],
      found: 2,
      page: 1,
      size: 24,
      facet_counts: [
        {
          field_name: '_product_i18n.categoryBreadcrumbs.displayPath',
          type: 'select' as const,
          stats: { total_values: 5 },
          counts: [
            {
              count: 1,
              value: 'Root B',
              data: {
                displayPath: 'Root B',
                idPath: 'root-b',
                position: 3,
              },
            },
            {
              count: 1,
              value: 'Root A > Child A2',
              data: {
                displayPath: 'Root A > Child A2',
                idPath: 'root-a > child-a2',
                position: 5,
              },
            },
            {
              count: 1,
              value: 'Root A',
              data: {
                displayPath: 'Root A',
                idPath: 'root-a',
                position: 1,
              },
            },
            {
              count: 1,
              value: 'Root A > Child A1',
              data: {
                displayPath: 'Root A > Child A1',
                idPath: 'root-a > child-a1',
                position: 2,
              },
            },
            {
              count: 1,
              value: 'Root B > Child B1',
              data: {
                displayPath: 'Root B > Child B1',
                idPath: 'root-b > child-b1',
                position: 0,
              },
            },
          ],
        },
        {
          field_name: '_product.categoryIds',
          type: 'select' as const,
          stats: { total_values: 5 },
          counts: [
            { count: 1, value: 'root-a' },
            { count: 1, value: 'child-a1' },
            { count: 1, value: 'child-a2' },
            { count: 1, value: 'root-b' },
            { count: 1, value: 'child-b1' },
          ],
        },
      ],
    };

    const result = buildBatteryIncludedCategoryTree(
      response,
      ['root-b', 'root-a'],
      'en',
      '_product_i18n.categoryBreadcrumbs.displayPath',
    );

    expect(result.snapshot?.roots.map((root) => root.id)).toEqual(['root-a', 'root-b']);
    expect(result.snapshot?.roots.map((root) => root.position)).toEqual([1, 3]);
    expect(
      getCategoryChildren(result.snapshot?.roots[0] ?? ({ id: '', name: {}, children: [] } as never)).map(
        (child) => child.id,
      ),
    ).toEqual(['child-a1', 'child-a2']);
    expect(result.snapshot?.byId['child-a1']).toMatchObject({ position: 2 });
    expect(result.snapshot?.byId['child-a2']).toMatchObject({ position: 5 });
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

  it('emits validation warnings when breadcrumb ids are missing from _product.categoryIds facet', () => {
    const response = {
      hits: [],
      found: 0,
      page: 0,
      size: 0,
      facet_counts: [
        {
          field_name: '_product_i18n.categories.breadcrumbs.displayPath',
          type: 'select' as const,
          stats: { total_values: 1 },
          counts: [
            {
              count: 2,
              value: 'Cables > USB-C',
              data: {
                displayPath: 'Cables > USB-C',
                idPath: 'root-a > child-a',
              },
            },
          ],
        },
        {
          field_name: '_product.categoryIds',
          type: 'select' as const,
          stats: { total_values: 1 },
          counts: [
            { count: 1, value: 'root-a' },
            // "child-a" is intentionally missing to trigger the validation warning
          ],
        },
      ],
    };

    const result = buildBatteryIncludedCategoryTree(
      response,
      ['root-a'],
      'en',
      '_product_i18n.categories.breadcrumbs.displayPath',
    );

    expect(result.validationWarnings).toContain('missing category id: child-a');
  });
});
