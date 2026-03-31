/**
 * Browse PLP URL scoped to a category (product search `filters[categoryIds]`).
 */
export function buildBrowseHrefForCategoryId(categoryId: string): string {
  const params = new URLSearchParams();
  params.append('filters[categoryIds]', categoryId.trim());
  return `/browse?${params.toString()}`;
}
