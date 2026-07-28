import type { EmporixCategoryTree } from '@/platform/integrations/emporix/model';

function treeContainsAnyCatalogId(tree: EmporixCategoryTree, catalogIds: ReadonlySet<string>): boolean {
  if (catalogIds.has(tree.id)) {
    return true;
  }
  const subs = tree.subcategories ?? [];
  for (const child of subs) {
    if (treeContainsAnyCatalogId(child, catalogIds)) {
      return true;
    }
  }
  return false;
}

/**
 * Catalogs store category ids that may be roots or descendants.
 * Category-tree APIs only expose full trees by root; this keeps trees whose root subtree contains any catalog id.
 */
export function filterEmporixCategoryTreesByCatalogIds(
  tenantRoots: EmporixCategoryTree[],
  catalogCategoryIds: string[],
): EmporixCategoryTree[] {
  if (catalogCategoryIds.length === 0) {
    return [];
  }
  const idSet = new Set(catalogCategoryIds);
  return tenantRoots.filter((root) => treeContainsAnyCatalogId(root, idSet));
}
