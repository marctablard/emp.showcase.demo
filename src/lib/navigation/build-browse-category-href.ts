import type { Category } from '@/platform/services/model/category';
import {
  BATTERY_INCLUDED_BREADCRUMB_FILTER,
  getBatteryIncludedCategoryMetadata,
} from '@/platform/services/model/category/batteryincluded-category';

/**
 * Browse PLP URL scoped to a category (product search `filters[categoryIds]`).
 * Extends the given URLSearchParams (or creates new ones) to preserve user searches.
 */
export function buildBrowseHrefForCategoryId(
  categoryId: string | null | undefined,
  category?: Category,
  searchParams?: URLSearchParams | null,
): string {
  const params = new URLSearchParams(searchParams || undefined);

  // Remove existing category filters and pagination
  params.delete(`filters[${BATTERY_INCLUDED_BREADCRUMB_FILTER}]`);
  params.delete('filters[categoryIds]');
  params.delete('page');

  if (categoryId) {
    const metadata = category ? getBatteryIncludedCategoryMetadata(category) : undefined;
    const displayPath = metadata?.displayPath ?? metadata?.facetValue;
    if (displayPath) {
      params.append(`filters[${BATTERY_INCLUDED_BREADCRUMB_FILTER}]`, displayPath);
    } else {
      params.append('filters[categoryIds]', categoryId.trim());
    }
  }

  const queryString = params.toString();
  return queryString ? `/browse?${queryString}` : '/browse';
}

/**
 * Browse PLP URL that clears only the category scope.
 * Drops category filters and page, keeps the search query, sort, currency, and other facets.
 */
export function buildBrowseHrefClearCategory(searchParams?: URLSearchParams | null): string {
  const params = new URLSearchParams(searchParams || undefined);

  params.delete(`filters[${BATTERY_INCLUDED_BREADCRUMB_FILTER}]`);
  params.delete('filters[categoryIds]');
  params.delete('page');

  const queryString = params.toString();
  return queryString ? `/browse?${queryString}` : '/browse';
}

/**
 * Browse PLP URL that resets all facets, sort, page, and search query.
 * Keeps structural context like currency, site, or locale.
 */
export function buildBrowseHrefResetAll(searchParams?: URLSearchParams | null): string {
  const params = new URLSearchParams(searchParams || undefined);

  const keysToDelete: string[] = [];
  params.forEach((_, key) => {
    if (key.startsWith('filters[') || key.startsWith('f[') || key === 'sort' || key === 'page' || key === 'q') {
      keysToDelete.push(key);
    }
  });

  for (const key of keysToDelete) {
    params.delete(key);
  }

  const queryString = params.toString();
  return queryString ? `/browse?${queryString}` : '/browse';
}
