import {
  buildBrowseHrefClearCategory,
  buildBrowseHrefForBreadcrumbDisplayPath,
  buildBrowseHrefForCategoryId,
  buildBrowseHrefResetAll,
} from './build-browse-category-href';

describe('buildBrowseHrefForBreadcrumbDisplayPath', () => {
  it('returns a category-scoped browse URL using displayPath', () => {
    expect(buildBrowseHrefForBreadcrumbDisplayPath('Cables > USB-C')).toBe(
      '/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Cables+%3E+USB-C',
    );
  });

  it('drops existing category filters and page but keeps q and other facets', () => {
    const searchParams = new URLSearchParams(
      'q=tubes&currency=EUR&filters[brand]=X&filters[_product_i18n.categoryBreadcrumbs.displayPath]=Metals&page=2&sort=price',
    );
    expect(buildBrowseHrefForBreadcrumbDisplayPath('Cables > USB-C', searchParams)).toBe(
      '/browse?q=tubes&currency=EUR&filters%5Bbrand%5D=X&sort=price&filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Cables+%3E+USB-C',
    );
  });
});

describe('buildBrowseHrefForCategoryId', () => {
  it('returns a category-scoped browse URL without carrying unrelated filters', () => {
    expect(
      buildBrowseHrefForCategoryId('cat-1', {
        id: 'cat-1',
        name: { en: 'USB-C' },
        customAttributes: {
          batteryIncludedCategory: {
            source: 'batteryincluded',
            displayPath: 'Cables > USB-C',
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

  it('handles null searchParams correctly', () => {
    expect(buildBrowseHrefForCategoryId('cat-2', undefined, null)).toBe('/browse?filters%5BcategoryIds%5D=cat-2');
  });

  it('scope mode preserves other facets and swaps the breadcrumb', () => {
    const searchParams = new URLSearchParams(
      'q=tubes&currency=EUR&filters[brand]=X&filters[_product_i18n.categoryBreadcrumbs.displayPath]=Metals&page=2',
    );
    expect(
      buildBrowseHrefForCategoryId(
        'cat-1',
        {
          id: 'cat-1',
          name: { en: 'USB-C' },
          customAttributes: {
            batteryIncludedCategory: {
              source: 'batteryincluded',
              displayPath: 'Cables > USB-C',
              facetValue: 'Cables > USB-C',
              labelPath: 'Cables > USB-C',
              leafLabel: 'USB-C',
              publicationAnchorId: 'cat-1',
              count: 4,
              idPath: ['root-a', 'cat-1'],
            },
          },
        } as never,
        searchParams,
      ),
    ).toBe(
      '/browse?q=tubes&currency=EUR&filters%5Bbrand%5D=X&filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Cables+%3E+USB-C',
    );
  });

  describe('buildBrowseHrefClearCategory', () => {
    it('drops only category filters and page but keeps q, facets, and sort', () => {
      const searchParams = new URLSearchParams(
        'q=tubes&currency=EUR&filters[brand]=X&filters[_product_i18n.categoryBreadcrumbs.displayPath]=Metals&page=2&sort=price',
      );
      expect(buildBrowseHrefClearCategory(searchParams)).toBe(
        '/browse?q=tubes&currency=EUR&filters%5Bbrand%5D=X&sort=price',
      );
    });
  });

  describe('buildBrowseHrefResetAll', () => {
    it('clears all facets, q, page, and sort; keeps other contextual parameters', () => {
      const searchParams = new URLSearchParams(
        'q=tubes&currency=EUR&filters[brand]=X&f[color]=red&filters[_product_i18n.categoryBreadcrumbs.displayPath]=Metals&page=2&sort=price&site=b2c',
      );
      expect(buildBrowseHrefResetAll(searchParams)).toBe('/browse?currency=EUR&site=b2c');
    });
  });
});
