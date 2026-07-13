import type { EmporixCategory } from '@/platform/integrations/emporix/model';
import type { EmporixLocalizedString } from '@/platform/integrations/emporix/model/common';
import type { Category } from '@/platform/services/model/category';

function coerceLocalizedName(name: unknown, fallbackId: string): EmporixLocalizedString {
  if (typeof name === 'string' && name.length > 0) {
    return { en: name };
  }
  if (name !== null && typeof name === 'object') {
    return name as EmporixLocalizedString;
  }
  return { en: fallbackId };
}

/**
 * Category list/search payloads sometimes use legacy `name: string` and embed `subcategories` on parents.
 */
export function normalizeCategoryForListMapping(row: EmporixCategory): EmporixCategory {
  return {
    ...row,
    name: coerceLocalizedName(row.name as unknown, row.id),
  };
}

/**
 * Drops duplicate rows: when the API returns a parent with `subcategories` and also returns each child as its own row,
 * only keep top-level rows for navigation (parent not in the same result set, or no parentId).
 */
export function selectTopLevelCategoryListRows(rows: EmporixCategory[]): EmporixCategory[] {
  const idSet = new Set(rows.map((r) => r.id));
  return rows.filter((r) => !r.parentId || !idSet.has(r.parentId));
}

function mapRowWithEmbeddedChildren(
  row: EmporixCategory,
  mapEmporixToCategory: (e: EmporixCategory) => Category,
): Category {
  const normalized = normalizeCategoryForListMapping(row);
  const base = mapEmporixToCategory(normalized);
  const subs = row.subcategories;
  if (!Array.isArray(subs) || subs.length === 0) {
    return base;
  }
  const children = subs
    .map((sub) => mapRowWithEmbeddedChildren(sub, mapEmporixToCategory))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return { ...base, children };
}

/**
 * Builds storefront navigation roots from GET /categories?q=id:(…) style responses without extra tree/subcategory calls
 * when the payload already includes `subcategories`.
 */
export function mapListCategoryRowsToNavigationCategories(
  listed: EmporixCategory[],
  mapEmporixToCategory: (e: EmporixCategory) => Category,
): Category[] {
  if (listed.length === 0) {
    return [];
  }
  const topLevel = selectTopLevelCategoryListRows(listed);
  return topLevel
    .map((row) => mapRowWithEmbeddedChildren(row, mapEmporixToCategory))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}
