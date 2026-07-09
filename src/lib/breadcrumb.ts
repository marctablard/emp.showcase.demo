import type { Category } from '@/platform/services/model/category';
import type { Product } from '@/platform/services/model/product';
import { l10n } from './utils';

export interface BreadcrumbContent {
  href: string;
  label: string;
}

function getCategoryHref(category: Category): string {
  return `/browse/${category.id}`;
}

/**
 * Recursively builds breadcrumb items for a category and its parents
 * @param category The category to build breadcrumb for
 * @param locale The current locale
 * @param breadcrumbs The accumulating breadcrumb array
 */
function buildCategoryBreadcrumbs(
  category: Category | undefined | null,
  locale: string,
  breadcrumbs: BreadcrumbContent[] = [],
): BreadcrumbContent[] {
  // Base case: if category is undefined or null, stop recursion
  if (!category) {
    return breadcrumbs;
  }

  // Add current category to breadcrumbs at the beginning
  breadcrumbs.unshift({
    href: getCategoryHref(category),
    label: l10n(category.name, locale),
  });

  // If this category has a parent, continue recursively
  if (category.parent && typeof category.parent === 'object') {
    return buildCategoryBreadcrumbs(category.parent, locale, breadcrumbs);
  }
  return breadcrumbs;
}

/**
 * Links a category to its parent chain (parents sorted root → leaf from the API).
 */
export function attachCategoryParentChain(category: Category, parents: Category[]): Category {
  const categoryWithParents = { ...category };
  if (parents.length === 0) {
    return categoryWithParents;
  }

  let linkedParent: Category = { ...parents[0] };
  for (let i = 1; i < parents.length; i++) {
    linkedParent = { ...parents[i], parent: linkedParent };
  }
  categoryWithParents.parent = linkedParent;
  return categoryWithParents;
}

export function generateBreadcrumbForCategory(category: Category, locale: string): BreadcrumbContent[] {
  return buildCategoryBreadcrumbs(category, locale, []);
}

export function generateBreadcrumbForProduct(product: Product, locale: string): BreadcrumbContent[] {
  const breadcrumbs: BreadcrumbContent[] = [];
  const primaryCategory = product.primaryCategory || product.categories?.[0] || null;
  // If the product has a primary category, build category breadcrumbs
  if (primaryCategory) {
    // Build category breadcrumbs
    buildCategoryBreadcrumbs(primaryCategory, locale, breadcrumbs);
  }
  // Add the product as the last breadcrumb item
  breadcrumbs.push({
    href: `/product/${product.id}`,
    label: l10n(product.name, locale),
  });

  // If no categories, just return home > product
  return breadcrumbs;
}
