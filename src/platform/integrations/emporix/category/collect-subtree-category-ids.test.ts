import type { EmporixCategoryTree } from '@/platform/integrations/emporix/model';
import { collectSubtreeIdsFromCategoryTrees } from './collect-subtree-category-ids';

describe('collectSubtreeIdsFromCategoryTrees', () => {
  const tree: EmporixCategoryTree[] = [
    {
      id: 'root',
      localizedName: { en: 'Root' },
      name: 'Root',
      position: 0,
      published: true,
      subcategories: [
        {
          id: 'mid',
          localizedName: { en: 'Mid' },
          name: 'Mid',
          position: 0,
          published: true,
          subcategories: [
            {
              id: 'leaf',
              localizedName: { en: 'Leaf' },
              name: 'Leaf',
              position: 0,
              published: true,
            },
          ],
        },
      ],
    },
  ];

  it('returns full tree from root target', () => {
    expect(collectSubtreeIdsFromCategoryTrees(tree, 'root').sort()).toEqual(['leaf', 'mid', 'root'].sort());
  });

  it('returns subtree for nested target', () => {
    expect(collectSubtreeIdsFromCategoryTrees(tree, 'mid').sort()).toEqual(['leaf', 'mid'].sort());
  });

  it('returns single id when target is leaf', () => {
    expect(collectSubtreeIdsFromCategoryTrees(tree, 'leaf')).toEqual(['leaf']);
  });

  it('returns [] when target not in trees', () => {
    expect(collectSubtreeIdsFromCategoryTrees(tree, 'missing')).toEqual([]);
  });
});
