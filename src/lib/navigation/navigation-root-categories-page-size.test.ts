import {
  getNavigationCategoryPreviewCount,
  getNavigationRootCategoriesPageSize,
} from './navigation-root-categories-page-size';

describe('getNavigationRootCategoriesPageSize', () => {
  const original = process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE;
    } else {
      process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE = original;
    }
  });

  it('defaults to 6 when unset', () => {
    delete process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE;
    expect(getNavigationRootCategoriesPageSize()).toBe(6);
  });

  it('parses a positive integer from env', () => {
    process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE = '12';
    expect(getNavigationRootCategoriesPageSize()).toBe(12);
  });

  it('falls back to default for invalid values', () => {
    process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE = '0';
    expect(getNavigationRootCategoriesPageSize()).toBe(6);
    process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE = 'nope';
    expect(getNavigationRootCategoriesPageSize()).toBe(6);
  });

  it('getNavigationCategoryPreviewCount matches getNavigationRootCategoriesPageSize', () => {
    delete process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE;
    expect(getNavigationCategoryPreviewCount()).toBe(getNavigationRootCategoriesPageSize());
    process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE = '4';
    expect(getNavigationCategoryPreviewCount()).toBe(4);
  });
});
