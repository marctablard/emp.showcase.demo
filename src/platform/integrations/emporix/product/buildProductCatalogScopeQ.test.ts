import { buildProductCategoryIdsCriteriaValue } from './buildProductCatalogScopeQ';

describe('buildProductCategoryIdsCriteriaValue', () => {
  it('returns undefined for empty input', () => {
    expect(buildProductCategoryIdsCriteriaValue([])).toBeUndefined();
  });

  it('returns undefined when all ids are blank', () => {
    expect(buildProductCategoryIdsCriteriaValue(['', '  '])).toBeUndefined();
  });

  it('wraps single id in parentheses (required for UUIDs with hyphens in Emporix q)', () => {
    expect(buildProductCategoryIdsCriteriaValue(['abc'])).toBe('(abc)');
    expect(buildProductCategoryIdsCriteriaValue(['812358ba-6327-4195-ac6b-bf77e1fb9718'])).toBe(
      '(812358ba-6327-4195-ac6b-bf77e1fb9718)',
    );
  });

  it('dedupes and joins multiple ids in parentheses', () => {
    expect(buildProductCategoryIdsCriteriaValue(['a', 'b', 'a'])).toBe('(a,b)');
  });
});
