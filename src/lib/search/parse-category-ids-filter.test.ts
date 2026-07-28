import { parseCategoryIdsFilterValue } from '@/lib/search/parse-category-ids-filter';

describe('parseCategoryIdsFilterValue', () => {
  it('returns empty for undefined, null, empty string', () => {
    expect(parseCategoryIdsFilterValue(undefined)).toEqual([]);
    expect(parseCategoryIdsFilterValue(null)).toEqual([]);
    expect(parseCategoryIdsFilterValue('')).toEqual([]);
    expect(parseCategoryIdsFilterValue('   ')).toEqual([]);
  });

  it('wraps a single id', () => {
    expect(parseCategoryIdsFilterValue('a')).toEqual(['a']);
  });

  it('dedupes array values', () => {
    expect(parseCategoryIdsFilterValue(['x', 'x', 'y'])).toEqual(['x', 'y']);
  });

  it('returns empty for record-shaped value', () => {
    expect(parseCategoryIdsFilterValue({ from: '1', till: '2' })).toEqual([]);
  });
});
