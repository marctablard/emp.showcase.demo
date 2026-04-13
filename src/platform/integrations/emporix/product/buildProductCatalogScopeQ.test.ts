import { buildProductCategoryIdsCriteriaValue } from './buildProductCatalogScopeQ';

describe('buildProductCategoryIdsCriteriaValue', () => {
  it('returns undefined for empty input', () => {
    expect(buildProductCategoryIdsCriteriaValue([])).toBeUndefined();
  });

  it('returns undefined when all ids are blank', () => {
    expect(buildProductCategoryIdsCriteriaValue(['', '  '])).toBeUndefined();
  });

  it('returns single id without brackets', () => {
    expect(buildProductCategoryIdsCriteriaValue(['abc'])).toBe('abc');
  });

  it('dedupes and joins multiple ids in parentheses', () => {
    expect(buildProductCategoryIdsCriteriaValue(['a', 'b', 'a'])).toBe('(a,b)');
  });
});
