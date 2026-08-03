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
              children: [
                withBatteryIncludedCategoryMetadata(
                  {
                    id: 'leaf-a',
                    name: { en: 'USB-C Gen 2' },
                  },
                  {
                    source: 'batteryincluded',
                    displayPath: 'Cables > USB-C > USB-C Gen 2',
                    facetValue: 'Cables > USB-C > USB-C Gen 2',
                    labelPath: 'Cables > USB-C > USB-C Gen 2',
                    leafLabel: 'USB-C Gen 2',
                    publicationAnchorId: 'root-a',
                    count: 1,
                    idPath: ['root-a', 'child-a', 'leaf-a'],
                  },
                ),
              ],
            },
            {
              source: 'batteryincluded',
              displayPath: 'Cables > USB-C',
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
        displayPath: undefined,
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

  it('prefers the deepest matching id when categoryIds contains an expanded path', () => {
    expect(
      resolveSelectedCategoryIdFromFilters(
        {
          categoryIds: ['root-a', 'child-a', 'leaf-a'],
        },
        navigationRoots,
      ),
    ).toBe('leaf-a');
  });

  it('prefers the deepest matching node when BI breadcrumb filters include progressive paths', () => {
    expect(
      resolveSelectedCategoryIdFromFilters(
        {
          '_product_i18n.categoryBreadcrumbs.displayPath': ['Cables', 'Cables > USB-C', 'Cables > USB-C > USB-C Gen 2'],
        },
        navigationRoots,
      ),
    ).toBe('leaf-a');
  });
});
