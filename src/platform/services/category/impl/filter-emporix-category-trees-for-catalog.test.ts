import type { EmporixCategoryTree } from '@/platform/integrations/emporix/model';
import { filterEmporixCategoryTreesByCatalogIds } from './filter-emporix-category-trees-for-catalog';

describe('filterEmporixCategoryTreesByCatalogIds', () => {
  const rootA: EmporixCategoryTree = {
    id: 'root-a',
    localizedName: { en: 'A' },
    position: 0,
    published: true,
    subcategories: [
      {
        id: 'child-a1',
        localizedName: { en: 'A1' },
        position: 0,
        published: true,
      },
    ],
  };

  const rootB: EmporixCategoryTree = {
    id: 'root-b',
    localizedName: { en: 'B' },
    position: 1,
    published: true,
  };

  it('returns trees whose root id is in the catalog set', () => {
    expect(filterEmporixCategoryTreesByCatalogIds([rootA, rootB], ['root-b'])).toEqual([rootB]);
  });

  it('returns trees that contain a matching descendant', () => {
    expect(filterEmporixCategoryTreesByCatalogIds([rootA, rootB], ['child-a1'])).toEqual([rootA]);
  });

  it('returns empty when no ids match', () => {
    expect(filterEmporixCategoryTreesByCatalogIds([rootA, rootB], ['other'])).toEqual([]);
  });

  it('returns empty when catalog id list is empty', () => {
    expect(filterEmporixCategoryTreesByCatalogIds([rootA], [])).toEqual([]);
  });
});
