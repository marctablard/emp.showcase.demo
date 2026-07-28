import { stripLocalizedBreadcrumbFilter } from './header-language-switcher';

describe('stripLocalizedBreadcrumbFilter', () => {
  it('removes localized breadcrumb filters and preserves unrelated query params', () => {
    expect(
      stripLocalizedBreadcrumbFilter(
        '?q=tiles&filters[_product_i18n.categoryBreadcrumbs.displayPath]=Home+%3E+Tiles&sort=price%3Aasc&page=2&filters[_product_i18n.categories.breadcrumbs.displayPath]=Home+%3E+Kacheln',
      ),
    ).toBe('q=tiles&sort=price%3Aasc&page=2');
  });

  it('returns an empty string when the search only contains breadcrumb filters', () => {
    expect(
      stripLocalizedBreadcrumbFilter(
        '?filters[_product_i18n.categoryBreadcrumbs.displayPath]=Home+%3E+Tiles&filters[_product_i18n.categories.breadcrumbs.displayPath]=Home+%3E+Kacheln',
      ),
    ).toBe('');
  });
});
