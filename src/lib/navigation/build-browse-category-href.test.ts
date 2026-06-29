import { buildBrowseHrefForCategoryId } from './build-browse-category-href';

describe('buildBrowseHrefForCategoryId', () => {
  it('returns a category-scoped browse URL without carrying unrelated filters', () => {
    expect(
      buildBrowseHrefForCategoryId('cat-1', {
        id: 'cat-1',
        name: { en: 'USB-C' },
        customAttributes: {
          batteryIncludedCategory: {
            source: 'batteryincluded',
            facetValue: 'Cables > USB-C',
            labelPath: 'Cables > USB-C',
            leafLabel: 'USB-C',
            publicationAnchorId: 'cat-1',
            count: 4,
            idPath: ['root-a', 'cat-1'],
          },
        },
      } as never),
    ).toBe('/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Cables+%3E+USB-C');
  });

  it('falls back to categoryIds when BI metadata is unavailable', () => {
    expect(buildBrowseHrefForCategoryId('cat-2')).toBe('/browse?filters%5BcategoryIds%5D=cat-2');
  });
});
