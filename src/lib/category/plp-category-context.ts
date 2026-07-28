import type { Category } from '@/platform/services/model/category';
import { findCategoryPath, getCategoryChildren } from './category-tree-utils';

export type PlpBreadcrumbRow = { kind: 'virtual-all-products' } | { kind: 'category'; category: Category };

export interface PlpCategoryContext {
  /** The full breadcrumb trail to the current category, empty if at root. */
  ancestorTrail: PlpBreadcrumbRow[];
  /** The currently selected category, or undefined if at root. */
  currentCategory: Category | undefined;
  /** Direct children of the current category, or root categories if at root. */
  currentChildren: Category[];
  /** The categories to show in the horizontal ribbon. */
  ribbonCategories: Category[];
  /** The set of IDs we need to fetch product counts for in the sidebar. */
  sidebarCountCategoryIds: string[];
}

export function resolvePlpCategoryContext(
  roots: readonly Category[] | undefined,
  selectedCategoryId: string | undefined,
): PlpCategoryContext {
  const rootCats = roots ? [...roots] : [];

  if (!roots || roots.length === 0 || !selectedCategoryId) {
    return {
      ancestorTrail: [],
      currentCategory: undefined,
      currentChildren: rootCats,
      ribbonCategories: rootCats,
      sidebarCountCategoryIds: rootCats.map((c) => c.id),
    };
  }

  const path = findCategoryPath(roots, selectedCategoryId);
  if (path.length === 0) {
    // ID not found in tree, fallback to root
    return {
      ancestorTrail: [],
      currentCategory: undefined,
      currentChildren: rootCats,
      ribbonCategories: rootCats,
      sidebarCountCategoryIds: rootCats.map((c) => c.id),
    };
  }

  const currentCategory = path[path.length - 1];
  const realAncestors = path.slice(0, -1);
  const ancestorTrail: PlpBreadcrumbRow[] = [
    { kind: 'virtual-all-products' },
    ...realAncestors.map((category) => ({ kind: 'category' as const, category })),
  ];
  const currentChildren = getCategoryChildren(currentCategory);
  const isLeaf = currentChildren.length === 0;

  let ribbonCategories: Category[];

  if (!isLeaf) {
    ribbonCategories = currentChildren;
  } else {
    if (realAncestors.length > 0) {
      const parent = realAncestors[realAncestors.length - 1];
      ribbonCategories = getCategoryChildren(parent);
    } else {
      ribbonCategories = rootCats;
    }
  }

  const sidebarCountCategoryIds = [currentCategory.id, ...currentChildren.map((c) => c.id)];

  return {
    ancestorTrail,
    currentCategory,
    currentChildren,
    ribbonCategories,
    sidebarCountCategoryIds,
  };
}
