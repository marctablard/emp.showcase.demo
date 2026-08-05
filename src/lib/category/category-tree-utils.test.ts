import {
  findCategoryPath,
  findDeepestCategoryPath,
  getCategoryChildren,
  getImmediateChildren,
  pruneEmptyBranches,
  walkCategoryTree,
} from '@/lib/category/category-tree-utils';
import type { Category } from '@/platform/services/model/category';

function cat(id: string, children: Category[] = []): Category {
  return {
    id,
    name: { en: id },
    ...(children.length > 0 ? { children } : {}),
  };
}

function deepChain(depth: number, prefix = 'n'): Category {
  let tail = cat(`${prefix}-${depth}`);
  for (let i = depth - 1; i >= 1; i -= 1) {
    tail = cat(`${prefix}-${i}`, [tail]);
  }
  return tail;
}

describe('category-tree-utils', () => {
  const sampleRoots: Category[] = [
    cat('root-a', [cat('a-1', [cat('a-1-1'), cat('a-1-2', [cat('a-1-2-x')])]), cat('a-2')]),
    cat('root-b', [cat('b-1')]),
  ];

  describe('getCategoryChildren', () => {
    it('returns empty array for missing, empty, or id-only children', () => {
      expect(getCategoryChildren(cat('leaf'))).toEqual([]);
      expect(getCategoryChildren({ id: 'x', name: { en: 'x' }, children: [] })).toEqual([]);
      expect(getCategoryChildren({ id: 'x', name: { en: 'x' }, children: ['child-id-1', 'child-id-2'] })).toEqual([]);
    });

    it('returns only Category-shaped entries', () => {
      const mixed: Category = {
        id: 'p',
        name: { en: 'p' },
        // runtime blend — the mapper never produces this but the type allows it
        children: [cat('c-1'), 'id-only', cat('c-2')] as unknown as Category[],
      };
      expect(getCategoryChildren(mixed).map((c) => c.id)).toEqual(['c-1', 'c-2']);
    });
  });

  describe('walkCategoryTree', () => {
    it('yields depth-first pre-order with ancestors', () => {
      const visited: Array<[string, string[]]> = [];
      walkCategoryTree(sampleRoots, (node, ancestors) => {
        visited.push([node.id, ancestors.map((a) => a.id)]);
      });
      expect(visited).toEqual([
        ['root-a', []],
        ['a-1', ['root-a']],
        ['a-1-1', ['root-a', 'a-1']],
        ['a-1-2', ['root-a', 'a-1']],
        ['a-1-2-x', ['root-a', 'a-1', 'a-1-2']],
        ['a-2', ['root-a']],
        ['root-b', []],
        ['b-1', ['root-b']],
      ]);
    });

    it('skips descendants when visit returns false', () => {
      const visited: string[] = [];
      walkCategoryTree(sampleRoots, (node) => {
        visited.push(node.id);
        return node.id === 'a-1' ? false : true;
      });
      expect(visited).toEqual(['root-a', 'a-1', 'a-2', 'root-b', 'b-1']);
    });

    it('no-ops on empty / undefined roots', () => {
      const spy = jest.fn();
      walkCategoryTree(undefined, spy);
      walkCategoryTree([], spy);
      expect(spy).not.toHaveBeenCalled();
    });

    it('handles 10-level-deep nesting without overflow', () => {
      const roots = [deepChain(10)];
      const visited: string[] = [];
      walkCategoryTree(roots, (node) => {
        visited.push(node.id);
      });
      expect(visited).toHaveLength(10);
      expect(visited[0]).toBe('n-1');
      expect(visited[9]).toBe('n-10');
    });
  });

  describe('findCategoryPath', () => {
    it('returns the ancestor chain including the matched node', () => {
      expect(findCategoryPath(sampleRoots, 'a-1-2-x').map((c) => c.id)).toEqual(['root-a', 'a-1', 'a-1-2', 'a-1-2-x']);
    });

    it('returns just the node when it is a root', () => {
      expect(findCategoryPath(sampleRoots, 'root-b').map((c) => c.id)).toEqual(['root-b']);
    });

    it('returns empty when id is missing / empty / unknown', () => {
      expect(findCategoryPath(sampleRoots, '')).toEqual([]);
      expect(findCategoryPath(sampleRoots, 'does-not-exist')).toEqual([]);
      expect(findCategoryPath(undefined, 'root-a')).toEqual([]);
    });

    it('finds nodes in a 10-level-deep tree', () => {
      const deep = [deepChain(10)];
      const path = findCategoryPath(deep, 'n-10').map((c) => c.id);
      expect(path).toHaveLength(10);
      expect(path[0]).toBe('n-1');
      expect(path[9]).toBe('n-10');
    });
  });

  describe('findDeepestCategoryPath', () => {
    it('returns the deepest matching path among candidates', () => {
      const path = findDeepestCategoryPath(sampleRoots, ['a-2', 'a-1-2-x', 'b-1']).map((c) => c.id);
      expect(path).toEqual(['root-a', 'a-1', 'a-1-2', 'a-1-2-x']);
    });

    it('keeps candidate order tie-break when longest depths are equal', () => {
      const path = findDeepestCategoryPath(sampleRoots, ['a-1-1', 'b-1']).map((c) => c.id);
      expect(path).toEqual(['root-a', 'a-1', 'a-1-1']);
    });

    it('returns empty array for empty candidates, no-match, or missing roots', () => {
      expect(findDeepestCategoryPath(sampleRoots, [])).toEqual([]);
      expect(findDeepestCategoryPath(sampleRoots, ['ghost', 'missing'])).toEqual([]);
      expect(findDeepestCategoryPath(undefined, ['a-1-2-x'])).toEqual([]);
    });
  });

  describe('getImmediateChildren', () => {
    it('returns the immediate children of the matched parent', () => {
      expect(getImmediateChildren(sampleRoots, 'a-1').map((c) => c.id)).toEqual(['a-1-1', 'a-1-2']);
    });

    it('returns the roots when parentId is empty / null / undefined', () => {
      expect(getImmediateChildren(sampleRoots, undefined).map((c) => c.id)).toEqual(['root-a', 'root-b']);
      expect(getImmediateChildren(sampleRoots, null).map((c) => c.id)).toEqual(['root-a', 'root-b']);
      expect(getImmediateChildren(sampleRoots, '').map((c) => c.id)).toEqual(['root-a', 'root-b']);
    });

    it('returns an empty array when parentId is unknown', () => {
      expect(getImmediateChildren(sampleRoots, 'ghost')).toEqual([]);
    });

    it('returns an empty array when parent has no children', () => {
      expect(getImmediateChildren(sampleRoots, 'a-2')).toEqual([]);
    });
  });

  describe('pruneEmptyBranches', () => {
    it('keeps nodes when the count is unknown', () => {
      const pruned = pruneEmptyBranches(sampleRoots, () => undefined);
      expect(pruned.map((r) => r.id)).toEqual(['root-a', 'root-b']);
    });

    it('drops leaves whose count is 0', () => {
      const counts: Record<string, number> = {
        'root-a': 5,
        'a-1': 5,
        'a-1-1': 0,
        'a-1-2': 0,
        'a-1-2-x': 0,
        'a-2': 2,
        'root-b': 0,
        'b-1': 0,
      };
      const pruned = pruneEmptyBranches(sampleRoots, (id) => counts[id]);
      expect(pruned.map((r) => r.id)).toEqual(['root-a']);
      const [ra] = pruned;
      expect(getCategoryChildren(ra).map((c) => c.id)).toEqual(['a-1', 'a-2']);
      const [a1] = getCategoryChildren(ra);
      expect(getCategoryChildren(a1)).toEqual([]);
    });

    it('keeps a parent when it has zero count but a descendant is non-empty', () => {
      const counts: Record<string, number> = {
        'root-a': 0,
        'a-1': 0,
        'a-1-1': 0,
        'a-1-2': 0,
        'a-1-2-x': 3,
        'a-2': 0,
        'root-b': 0,
        'b-1': 0,
      };
      const pruned = pruneEmptyBranches(sampleRoots, (id) => counts[id]);
      expect(pruned.map((r) => r.id)).toEqual(['root-a']);
      const ra = pruned[0];
      expect(getCategoryChildren(ra).map((c) => c.id)).toEqual(['a-1']);
      const a1 = getCategoryChildren(ra)[0];
      expect(getCategoryChildren(a1).map((c) => c.id)).toEqual(['a-1-2']);
    });

    it('no-ops on empty forest', () => {
      expect(pruneEmptyBranches([], () => 0)).toEqual([]);
      expect(pruneEmptyBranches(undefined, () => 0)).toEqual([]);
    });
  });
});
