import type { Category } from '@/platform/services/model/category';
import { getBatteryIncludedCategoryMetadata } from '@/platform/services/model/category/batteryincluded-category';
import type { Product } from '@/platform/services/model/product';
import type { BatteryIncludedCategoryTreeSnapshot } from '@/platform/services/search/impl/batteryincluded-category-tree';
import { findDeepestCategoryPath } from './category/category-tree-utils';
import { L10N_MISSING_LABEL, l10n } from './l10n';
import {
  buildBrowseHrefForBreadcrumbDisplayPath,
  buildBrowseHrefForCategoryId,
} from './navigation/build-browse-category-href';

export interface BreadcrumbContent {
  href: string;
  label: string;
}

function splitPathLevels(path: string): string[] {
  return path
    .split(' > ')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getProductCategoryCandidates(product: Product): string[] {
  const candidateIds = [
    product.primaryCategory?.id,
    ...(product.categoryIds ?? []),
    ...(product.categories?.map((category) => category.id) ?? []),
  ].filter((id): id is string => Boolean(id));

  return Array.from(new Set(candidateIds));
}

function buildBreadcrumbsFromNavigationPath(path: Category[], locale: string): BreadcrumbContent[] {
  if (path.length === 0) {
    return [];
  }

  const metadataByLevel = path.map((category) => getBatteryIncludedCategoryMetadata(category));
  const hasBiMetadata = metadataByLevel.some(Boolean);
  const leafMetadataWithDisplayPath = [...metadataByLevel].reverse().find((metadata) => Boolean(metadata?.displayPath));
  const leafMetadata = [...metadataByLevel].reverse().find(Boolean);

  if (hasBiMetadata && leafMetadataWithDisplayPath?.displayPath) {
    const displayLevels = splitPathLevels(leafMetadataWithDisplayPath.displayPath);
    return path.map((category, index) => {
      const cumulativeDisplayPath = displayLevels.slice(0, index + 1).join(' > ');
      const perLevelMetadata = metadataByLevel[index];
      const fallbackDisplayPath =
        perLevelMetadata?.displayPath ??
        perLevelMetadata?.labelPath ??
        splitPathLevels(leafMetadataWithDisplayPath.labelPath)
          .slice(0, index + 1)
          .join(' > ');

      return {
        href: buildBrowseHrefForBreadcrumbDisplayPath(cumulativeDisplayPath || fallbackDisplayPath),
        label: l10n(category.name, locale),
      };
    });
  }

  if (hasBiMetadata) {
    return path.map((category, index) => {
      const perLevelMetadata = metadataByLevel[index];
      const fallbackFromLeafLabelPath = splitPathLevels(leafMetadata?.labelPath ?? '')
        .slice(0, index + 1)
        .join(' > ');
      return {
        href: buildBrowseHrefForBreadcrumbDisplayPath(
          perLevelMetadata?.displayPath ?? perLevelMetadata?.labelPath ?? fallbackFromLeafLabelPath,
        ),
        label: l10n(category.name, locale),
      };
    });
  }

  return path.map((category) => ({
    href: buildBrowseHrefForCategoryId(category.id, category),
    label: l10n(category.name, locale),
  }));
}

function getDeepestBatteryIncludedEntry(
  product: Product,
  biSnapshot: BatteryIncludedCategoryTreeSnapshot,
): BatteryIncludedCategoryTreeSnapshot['byId'][string] | null {
  let selectedEntry: BatteryIncludedCategoryTreeSnapshot['byId'][string] | null = null;

  getProductCategoryCandidates(product).forEach((categoryId) => {
    const entry = biSnapshot.byId[categoryId];
    if (!entry?.displayPath) {
      return;
    }

    const selectedIdPathLength = selectedEntry?.idPath.length ?? -1;
    const currentIdPathLength = entry.idPath.length;

    if (currentIdPathLength > selectedIdPathLength) {
      selectedEntry = entry;
      return;
    }

    if (currentIdPathLength < selectedIdPathLength) {
      return;
    }

    const selectedDisplayPathLevelCount = splitPathLevels(selectedEntry?.displayPath ?? '').length;
    const currentDisplayPathLevelCount = splitPathLevels(entry.displayPath).length;

    if (currentDisplayPathLevelCount > selectedDisplayPathLevelCount) {
      selectedEntry = entry;
    }
  });

  return selectedEntry;
}

function buildEmporixParentChain(primaryCategory: Category | null): Category[] {
  if (!primaryCategory?.id) {
    return [];
  }

  const parentChain: Category[] = [];
  let current: Category | undefined | null = primaryCategory;
  while (current) {
    parentChain.unshift(current);
    current = current.parent && typeof current.parent === 'object' ? current.parent : null;
  }

  return parentChain;
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
  emporixAncestorTrail?: Category[] | null,
  navigationRoots?: Category[] | null,
): BreadcrumbContent[] {
  const primaryCategory = product.primaryCategory || product.categories?.[0] || null;
  const navigationPath = findDeepestCategoryPath(navigationRoots ?? undefined, getProductCategoryCandidates(product));
  const breadcrumbs: BreadcrumbContent[] = buildBreadcrumbsFromNavigationPath(navigationPath, locale);

  // Secondary fallback chain starts only when nav forest misses.
  if (breadcrumbs.length === 0 && engine === 'batteryincluded' && biSnapshot) {
    const lookupEntry = getDeepestBatteryIncludedEntry(product, biSnapshot);
    if (lookupEntry?.displayPath) {
      // BI mode: split displayPath into levels and build cumulative displayPath links.
      const rawLevels = splitPathLevels(lookupEntry.displayPath);
      const labels = splitPathLevels(lookupEntry.labelPath);

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

  // Fallback to Emporix ancestry.
  if (breadcrumbs.length === 0) {
    const ancestry = emporixAncestorTrail?.length ? emporixAncestorTrail : buildEmporixParentChain(primaryCategory);

    ancestry.forEach((cat) => {
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
