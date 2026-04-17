import type { Category } from '@/platform/services/model/category';
import type { Product } from '@/platform/services/model/product';
import { l10n } from './utils';

export interface BreadcrumbContent {
  href: string;
  label: string;
}

function getCategorySlug(category: Category, locale: string): string {
  if (category.slug) {
    return l10n(category.slug, locale);
  }
  if (category.code) {
    return '/category/' + category.code;
  }
  return `/category/?id=${category.id}`;
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
    href: getCategorySlug(category, locale),
    label: l10n(category.name, locale),
  });

  // If this category has a parent, continue recursively
  if (category.parent && typeof category.parent === 'object') {
    return buildCategoryBreadcrumbs(category.parent, locale, breadcrumbs);
  }
  return breadcrumbs;
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
