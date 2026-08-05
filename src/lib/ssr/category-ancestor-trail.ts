import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { Category } from '@/platform/services/model/category';
import ssr from '@/platform/ssr';

/**
 * Resolves an ordered Emporix ancestor trail (root -> leaf) for a leaf category id.
 *
 * Callers should pick the leaf id before calling this helper using:
 * `primaryCategory?.id`, then `categoryIds[0]`, then `categories[0].id`.
 */
export async function getCategoryAncestorTrail(
  leafCategoryId: string | null | undefined,
  leafCategory?: Category | null,
): Promise<Category[]> {
  const normalizedLeafCategoryId = leafCategoryId?.trim();
  if (!normalizedLeafCategoryId) {
    return [];
  }

  try {
    const categoryService = ssr.get<CategoryService>('CategoryService');
    const parents = await categoryService.getCategoryParents(normalizedLeafCategoryId);

    if (parents.length === 0) {
      return [];
    }

    const resolvedLeafCategory =
      leafCategory && leafCategory.id === normalizedLeafCategoryId
        ? leafCategory
        : await categoryService.getCategoryById(normalizedLeafCategoryId);

    if (!resolvedLeafCategory) {
      return [];
    }

    const lastParent = parents.at(-1);
    if (lastParent?.id === resolvedLeafCategory.id) {
      return parents;
    }

    return [...parents, resolvedLeafCategory];
  } catch {
    return [];
  }
}
