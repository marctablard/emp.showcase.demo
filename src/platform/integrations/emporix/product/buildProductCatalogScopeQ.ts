/**
 * Builds the value segment for Product Service `q` when filtering by `categoryIds`
 * (multi-value form per Emporix q-param — same pattern as `buildOrderIdsQuery` for returns).
 *
 * @returns `undefined` when there are no ids; otherwise a value suitable for
 * `criteria` entry `categoryIds` so that `buildSearchQuery` emits `categoryIds:id` or `categoryIds:(a,b)`.
 */
export function buildProductCategoryIdsCriteriaValue(categoryIds: string[]): string | undefined {
  const unique = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return undefined;
  }
  if (unique.length === 1) {
    return unique[0];
  }
  return `(${unique.join(',')})`;
}
