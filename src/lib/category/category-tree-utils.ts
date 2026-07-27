import type { Category } from '@/platform/services/model/category';

/**
 * Pure helpers for navigating the site-scoped category forest shipped by
 * `getCachedNavigationCategoryTrees`. All helpers treat `children` defensively:
 * after `mapEmporixCategoryTreeToCategory` the runtime shape is `Category[]`, but the
 * `Category` type still allows `string[]`, so we skip id-only entries.
 *
 * Placed under `src/lib/category/` (not `src/utils/`) so the Library Tests Jest project
 * picks up the sibling `.test.ts`; keeps helper + test colocated with other pure lib code.
 */

/**
 * Safely extract the `Category` children of a node. Returns an empty array when children
 * are missing, stored as ids (`string[]`), or somehow non-array.
 */
export function getCategoryChildren(node: Category): Category[] {
  const children = node.children;
  if (!Array.isArray(children) || children.length === 0) {
    return [];
  }
  return children.filter((entry): entry is Category => typeof entry === 'object' && entry !== null && 'id' in entry);
}

/**
 * Compares two position-bearing nodes for stable navigation ordering: nodes with a real,
 * non-zero `position` sort ascending first, nodes with `position === 0` sort next, and nodes
 * with no `position` (`undefined`) sort last. Shared by the Emporix category-tree, category-list,
 * and category-service mappers so all navigation sources order categories consistently.
 */
export function compareByPosition<T extends { position?: number }>(a: T, b: T): number {
  const aPosition = a.position;
  const bPosition = b.position;

  if (aPosition === undefined && bPosition === undefined) return 0;
  if (aPosition === undefined) return 1;
  if (bPosition === undefined) return -1;

  if (aPosition === 0 && bPosition === 0) return 0;
  if (aPosition === 0) return 1;
  if (bPosition === 0) return -1;

  return aPosition - bPosition;
}

/**
 * Depth-first pre-order walk. `visit` receives each node and its ancestor chain
 * (parent-first, immediate parent last). Return `false` from `visit` to skip descending
 * into that node's children; any other value (including `undefined`) continues the walk.
 */
export function walkCategoryTree(
  roots: readonly Category[] | undefined,
  visit: (node: Category, ancestors: readonly Category[]) => void | boolean,
): void {
  if (!roots || roots.length === 0) {
    return;
  }
  const stack: Array<{ node: Category; ancestors: Category[] }> = [];
  for (let i = roots.length - 1; i >= 0; i -= 1) {
    stack.push({ node: roots[i], ancestors: [] });
  }
  while (stack.length > 0) {
    const { node, ancestors } = stack.pop() as { node: Category; ancestors: Category[] };
    const descend = visit(node, ancestors);
    if (descend === false) {
      continue;
    }
    const children = getCategoryChildren(node);
    const nextAncestors = ancestors.concat(node);
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: children[i], ancestors: nextAncestors });
    }
  }
}

/**
 * Return the ancestor chain (inclusive of the matched node) for the supplied id.
 * Returns an empty array when the id is not present in the forest.
 */
export function findCategoryPath(roots: readonly Category[] | undefined, id: string): Category[] {
  if (!roots || roots.length === 0 || !id) {
    return [];
  }
  let found: Category[] = [];
  walkCategoryTree(roots, (node, ancestors) => {
    if (found.length > 0) {
      return false;
    }
    if (node.id === id) {
      found = ancestors.concat(node);
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Immediate `Category` children of the node matching `parentId`. Returns the supplied
 * roots when `parentId` is empty / unknown — callers can use that as a "show top-level"
 * fallback without branching themselves.
 */
export function getImmediateChildren(
  roots: readonly Category[] | undefined,
  parentId: string | undefined | null,
): Category[] {
  if (!roots || roots.length === 0) {
    return [];
  }
  if (!parentId) {
    return [...roots];
  }
  let match: Category | undefined;
  walkCategoryTree(roots, (node) => {
    if (match) {
      return false;
    }
    if (node.id === parentId) {
      match = node;
      return false;
    }
    return true;
  });
  return match ? getCategoryChildren(match) : [];
}

/**
 * Remove nodes where the node itself and every descendant has a count of 0. A node is
 * kept when: the count is unknown (`getCount` returns `undefined`), the node itself has a
 * positive count, or any descendant (recursively) has a positive count.
 *
 * Pruning is purely structural — the caller keeps the original forest untouched so the
 * counts layer can re-evaluate lazily as more ids resolve.
 */
export function pruneEmptyBranches(
  roots: readonly Category[] | undefined,
  getCount: (categoryId: string) => number | undefined,
): Category[] {
  if (!roots || roots.length === 0) {
    return [];
  }
  const prune = (node: Category): Category | null => {
    const originalChildren = getCategoryChildren(node);
    const prunedChildren = originalChildren.map(prune).filter((child): child is Category => child !== null);
    const own = getCount(node.id);
    const hasVisibleSelf = own === undefined || own > 0;
    if (!hasVisibleSelf && prunedChildren.length === 0) {
      return null;
    }
    // When children changed, rewrite the `children` field so callers never see stale pruned
    // nodes; when the prune left no children, drop the key so leaf checks behave naturally.
    const childrenChanged =
      prunedChildren.length !== originalChildren.length || prunedChildren.some((c, idx) => c !== originalChildren[idx]);
    if (!childrenChanged) {
      return node;
    }
    const { children: _discardedChildren, ...rest } = node;
    return prunedChildren.length > 0 ? { ...rest, children: prunedChildren } : rest;
  };
  return roots.map(prune).filter((n): n is Category => n !== null);
}
