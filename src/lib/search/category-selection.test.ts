import type { Category } from '@/platform/services/model/category';
import { withBatteryIncludedCategoryMetadata } from '@/platform/services/model/category/batteryincluded-category';
import { resolveSelectedCategoryIdFromFilters } from './category-selection';

describe('resolveSelectedCategoryIdFromFilters', () => {
  const navigationRoots: Category[] = [
    withBatteryIncludedCategoryMetadata(
      {
        id: 'root-a',
        name: { en: 'Cables' },
        children: [
          withBatteryIncludedCategoryMetadata(
            {
              id: 'child-a',
              name: { en: 'USB-C' },
            },
            {
              source: 'batteryincluded',
              facetValue: 'Cables > USB-C',
              labelPath: 'Cables > USB-C',
              leafLabel: 'USB-C',
              publicationAnchorId: 'root-a',
              count: 2,
              idPath: ['root-a', 'child-a'],
            },
          ),
        ],
      },
      {
        source: 'batteryincluded',
        facetValue: undefined,
        labelPath: 'Cables',
        leafLabel: 'Cables',
        publicationAnchorId: 'root-a',
        count: 2,
        idPath: ['root-a'],
      },
    ),
  ];

  it('prefers legacy categoryIds when present', () => {
    expect(
      resolveSelectedCategoryIdFromFilters(
        {
          categoryIds: 'child-a',
          _product_i18n: 'ignored',
        },
        navigationRoots,
      ),
    ).toBe('child-a');
  });

  it('resolves the selected category id from the BI breadcrumb facet', () => {
    expect(
      resolveSelectedCategoryIdFromFilters(
        {
          '_product_i18n.categories.breadcrumbs.displayPath': 'Cables > USB-C',
        },
        navigationRoots,
      ),
    ).toBe('child-a');
  });
});
