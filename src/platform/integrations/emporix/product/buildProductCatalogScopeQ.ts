/**
 * Builds the value segment for Product Service `q` when filtering by `categoryIds`.
 *
 * Emporix `q` treats multiple values as `field:(id1,id2)` (see standard q-param docs). UUIDs contain
 * hyphens; a bare `categoryIds:812358ba-6327-…` is parsed incorrectly, so we always use the
 * parenthesized form, including for a single id: `categoryIds:(812358ba-6327-…)`.
 */
export function buildProductCategoryIdsCriteriaValue(categoryIds: string[]): string | undefined {
  const unique = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return undefined;
  }
  return `(${unique.join(',')})`;
}
