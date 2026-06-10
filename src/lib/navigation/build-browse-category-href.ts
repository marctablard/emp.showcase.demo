import type { Category } from '@/platform/services/model/category';
import {
  BATTERY_INCLUDED_BREADCRUMB_FILTER,
  getBatteryIncludedCategoryMetadata,
} from '@/platform/services/model/category/batteryincluded-category';

/**
 * Browse PLP URL scoped to a category (product search `filters[categoryIds]`).
 */
export function buildBrowseHrefForCategoryId(categoryId: string, category?: Category): string {
  const params = new URLSearchParams();
  const metadata = category ? getBatteryIncludedCategoryMetadata(category) : undefined;
  if (metadata?.facetValue) {
    params.append(`filters[${BATTERY_INCLUDED_BREADCRUMB_FILTER}]`, metadata.facetValue);
  } else {
    params.append('filters[categoryIds]', categoryId.trim());
  }
  return `/browse?${params.toString()}`;
}
