import { takeRootCategoryPage } from './take-root-category-page';

describe('takeRootCategoryPage', () => {
  it('returns all items when under limit', () => {
    const items = ['a', 'b'];
    expect(takeRootCategoryPage(items, 6)).toEqual({
      visible: ['a', 'b'],
      truncated: false,
      total: 2,
    });
  });

  it('returns all items when count equals limit', () => {
    const items = ['a', 'b', 'c'];
    expect(takeRootCategoryPage(items, 3)).toEqual({
      visible: ['a', 'b', 'c'],
      truncated: false,
      total: 3,
    });
  });

  it('truncates when over limit', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(takeRootCategoryPage(items, 3)).toEqual({
      visible: ['a', 'b', 'c'],
      truncated: true,
      total: 4,
    });
  });

  it('handles empty list', () => {
    expect(takeRootCategoryPage([], 6)).toEqual({
      visible: [],
      truncated: false,
      total: 0,
    });
  });
});
