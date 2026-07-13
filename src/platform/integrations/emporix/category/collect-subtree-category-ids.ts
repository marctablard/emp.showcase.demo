import type { EmporixCategoryTree } from '@/platform/integrations/emporix/model';

/**
 * Collects {@link targetId} and all descendant category ids from trees returned by
 * POST /category-trees/search (trees that contain the target node).
 */
export function collectSubtreeIdsFromCategoryTrees(trees: EmporixCategoryTree[], targetId: string): string[] {
  const collectFromNode = (node: EmporixCategoryTree): string[] => {
    const ids = [node.id];
    const subs = node.subcategories;
    if (Array.isArray(subs)) {
      for (const child of subs) {
        ids.push(...collectFromNode(child));
      }
    }
    return ids;
  };

  const findAndCollect = (node: EmporixCategoryTree): string[] | null => {
    if (node.id === targetId) {
      return collectFromNode(node);
    }
    const subs = node.subcategories;
    if (Array.isArray(subs)) {
      for (const child of subs) {
        const found = findAndCollect(child);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  for (const root of trees) {
    const found = findAndCollect(root);
    if (found) {
      return found;
    }
  }
  return [];
}
