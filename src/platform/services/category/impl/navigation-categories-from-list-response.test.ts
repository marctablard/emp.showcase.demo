import type { EmporixCategory } from '@/platform/integrations/emporix/model';
import type { Category } from '@/platform/services/model/category';
import {
  mapListCategoryRowsToNavigationCategories,
  selectTopLevelCategoryListRows,
} from './navigation-categories-from-list-response';

function idMap(c: EmporixCategory): Category {
  return {
    id: c.id,
    name: typeof c.name === 'string' ? { en: c.name } : (c.name as Category['name']),
    position: c.position,
  };
}

describe('selectTopLevelCategoryListRows', () => {
  it('excludes children when parent is present in the same batch', () => {
    const parent: EmporixCategory = {
      id: 'p1',
      name: { en: 'P' },
      subcategories: [],
    };
    const child: EmporixCategory = {
      id: 'c1',
      parentId: 'p1',
      name: { en: 'C' },
    };
    const rows = [parent, child];
    expect(selectTopLevelCategoryListRows(rows)).toEqual([parent]);
  });
});

describe('mapListCategoryRowsToNavigationCategories', () => {
  it('maps embedded subcategories without extra API shape', () => {
    const listed: EmporixCategory[] = [
      {
        id: '38118',
        name: { en: 'ProductRoot' },
        code: 'productroot',
        position: 1,
        published: true,
        subcategories: [
          {
            id: '38198',
            parentId: '38118',
            name: { en: 'Child1' },
            position: 1,
            published: true,
          },
          {
            id: '38199',
            parentId: '38118',
            name: { en: 'Child2' },
            position: 2,
            published: true,
          },
        ],
      },
      {
        id: '38198',
        parentId: '38118',
        name: { en: 'Child1' },
        position: 1,
        published: true,
      },
      {
        id: '38199',
        parentId: '38118',
        name: { en: 'Child2' },
        position: 2,
        published: true,
      },
    ];
    const out = mapListCategoryRowsToNavigationCategories(listed, idMap);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('38118');
    expect(out[0].children?.map((c) => (typeof c === 'string' ? c : c.id)).sort()).toEqual(['38198', '38199']);
  });
});
