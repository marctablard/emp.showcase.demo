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

export interface SegmentScopeCompoundQueryInput {
  /** User-selected (already sanitised) category filter; narrows the segment scope with AND. */
  selectedCategoryIds: string[];
  /** Categories assigned to the customer's segments — passed unexpanded, Emporix resolves subcategories. */
  assignedCategoryIds: string[];
  /** Products directly assigned to the customer's segments. */
  productIds: string[];
}

/**
 * Builds the **full** `compoundLogicalQuery:(…)` fragment scoping a Product Service search to the
 * customer's segments (COP-4822). `buildSearchQuery` appends the `compoundLogicalQuery` criteria
 * verbatim (no `key:` prefix), so the prefix is part of the returned string.
 *
 * - `compoundLogicalQuery:((categoryIds:(a,b)) OR (id:(p1,p2)))`
 * - with a selected category: `compoundLogicalQuery:((categoryIds:(sel)) AND ((categoryIds:(a,b)) OR (id:(p1))))`
 * - an empty OR branch is omitted; `undefined` when both scope parts are empty (caller returns no results).
 *
 * Ids use the same unquoted `(a,b)` list form as `buildProductCategoryIdsCriteriaValue`.
 */
export function buildSegmentScopeCompoundQuery({
  selectedCategoryIds,
  assignedCategoryIds,
  productIds,
}: SegmentScopeCompoundQueryInput): string | undefined {
  const categoryValue = buildProductCategoryIdsCriteriaValue(assignedCategoryIds);
  const productValue = buildProductCategoryIdsCriteriaValue(productIds);

  const branches: string[] = [];
  if (categoryValue) {
    branches.push(`(categoryIds:${categoryValue})`);
  }
  if (productValue) {
    branches.push(`(id:${productValue})`);
  }
  if (branches.length === 0) {
    return undefined;
  }

  const scope = branches.length === 1 ? branches[0] : `(${branches.join(' OR ')})`;
  const selectedValue = buildProductCategoryIdsCriteriaValue(selectedCategoryIds);
  const expression = selectedValue ? `((categoryIds:${selectedValue}) AND ${scope})` : scope;

  return `compoundLogicalQuery:${expression}`;
}
