import { getAppliedFilterCount } from './get-applied-filter-count';

describe('getAppliedFilterCount', () => {
  it('counts only non-category active filter keys once', () => {
    expect(
      getAppliedFilterCount({
        color: ['red', 'blue'],
        price: { from: '10', till: '50' },
        categoryIds: ['root-1', 'child-1'],
        '_product_i18n.categoryBreadcrumbs.displayPath': 'Electronics > Phones',
      }),
    ).toBe(2);
  });
});
