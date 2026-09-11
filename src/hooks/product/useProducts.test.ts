import type { Product } from '@/platform/services/model/product';
import { mergeProductFetchResults } from './useProducts';

const product = (id: string): Product => ({ id, name: id }) as Product;

describe('mergeProductFetchResults', () => {
  it('keeps cached products that were not requested in this pass', () => {
    const cached = product('cached');
    const fetched = product('fresh');

    expect(
      mergeProductFetchResults(
        ['cached', 'fresh'],
        [fetched],
        (id) => (id === 'cached' ? cached : null),
        new Set(['fresh']),
      ),
    ).toEqual([cached, fetched]);
  });

  it('drops a confirmed miss instead of reusing the id-keyed store entry', () => {
    const stale = product('stale');

    expect(
      mergeProductFetchResults(['stale'], [null], (id) => (id === 'stale' ? stale : null), new Set(['stale'])),
    ).toEqual([]);
  });
});
