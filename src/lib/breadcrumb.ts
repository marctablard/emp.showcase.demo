import type { Category } from '@/platform/services/model/category';
import type { Product } from '@/platform/services/model/product';
import type { BatteryIncludedCategoryTreeSnapshot } from '@/platform/services/search/impl/batteryincluded-category-tree';
import { L10N_MISSING_LABEL, l10n } from './l10n';
import {
  buildBrowseHrefForBreadcrumbDisplayPath,
  buildBrowseHrefForCategoryId,
} from './navigation/build-browse-category-href';

export interface BreadcrumbContent {
  href: string;
  label: string;
}

function getCategorySlug(category: Category, locale: string): string {
  if (category.slug) {
    const slug = l10n(category.slug, locale);
    if (slug !== L10N_MISSING_LABEL) {
      return slug;
    }
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

/**
 * Generates an engine-aware visible breadcrumb for the PDP.
 * @param product The current PDP product.
 * @param locale The current locale.
 * @param engine active search engine ('batteryincluded' | 'emporix')
 * @param biSnapshot The cached BI category snapshot (if BI engine is active and snapshot exists).
 */
export function generateVisibleBreadcrumbForPdp(
  product: Product,
  locale: string,
  engine: 'batteryincluded' | 'emporix',
  biSnapshot: BatteryIncludedCategoryTreeSnapshot | null,
): BreadcrumbContent[] {
  const breadcrumbs: BreadcrumbContent[] = [];
  const primaryCategory = product.primaryCategory || product.categories?.[0] || null;

  // Primary strategy for BI
  if (engine === 'batteryincluded' && biSnapshot) {
    const targetCategoryId = product.primaryCategory?.id || product.categoryIds?.[0] || product.categories?.[0]?.id;

    if (targetCategoryId) {
      const lookupEntry = biSnapshot.byId[targetCategoryId];
      if (lookupEntry?.displayPath) {
        // Bi mode: split displayPath into levels and build cumulative displayPath links
        const rawLevels = lookupEntry.displayPath
          .split(' > ')
          .map((s) => s.trim())
          .filter(Boolean);
        const labels = lookupEntry.labelPath
          .split(' > ')
          .map((s) => s.trim())
          .filter(Boolean);

        let cumulative = '';
        rawLevels.forEach((level, index) => {
          cumulative = cumulative ? `${cumulative} > ${level}` : level;
          breadcrumbs.push({
            href: buildBrowseHrefForBreadcrumbDisplayPath(cumulative),
            label: labels[index] || level,
          });
        });
      }
    }
  }

  // Fallback to Emporix ancestry
  if (breadcrumbs.length === 0 && primaryCategory && primaryCategory.id) {
    const parentChain: Category[] = [];
    let current: Category | undefined | null = primaryCategory;
    while (current) {
      parentChain.unshift(current);
      current = current.parent && typeof current.parent === 'object' ? current.parent : null;
    }

    parentChain.forEach((cat) => {
      breadcrumbs.push({
        href: buildBrowseHrefForCategoryId(cat.id, cat),
        label: l10n(cat.name, locale),
      });
    });
  }

  // Terminal fallback: final item
  breadcrumbs.push({
    href: `/product/${product.id}`,
    label: l10n(product.name, locale),
  });

  return breadcrumbs;
}
