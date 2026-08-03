import type { Category } from '@/platform/services/model/category';

export const BATTERY_INCLUDED_CATEGORY_METADATA_KEY = 'batteryIncludedCategory';
export const BATTERY_INCLUDED_BREADCRUMB_FILTER = '_product_i18n.categoryBreadcrumbs.displayPath';
export const BATTERY_INCLUDED_PUBLISHED_FILTER = '_product.published';
export const BATTERY_INCLUDED_CATEGORY_IDS_FILTER = '_product.categoryIds';

export interface BatteryIncludedCategoryMetadata {
  source: 'batteryincluded';
  displayPath?: string;
  facetValue?: string;
  labelPath: string;
  leafLabel: string;
  publicationAnchorId: string;
  count: number;
  idPath: string[];
}

export function getBatteryIncludedCategoryMetadata(
  category: Category | null | undefined,
): BatteryIncludedCategoryMetadata | undefined {
  const raw = category?.customAttributes?.[BATTERY_INCLUDED_CATEGORY_METADATA_KEY];
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const metadata = raw as Partial<BatteryIncludedCategoryMetadata>;
  if (metadata.source !== 'batteryincluded' || !metadata.leafLabel || !metadata.labelPath) {
    return undefined;
  }
  return metadata as BatteryIncludedCategoryMetadata;
}

export function withBatteryIncludedCategoryMetadata(
  category: Category,
  metadata: BatteryIncludedCategoryMetadata,
): Category {
  return {
    ...category,
    customAttributes: {
      ...(category.customAttributes ?? {}),
      [BATTERY_INCLUDED_CATEGORY_METADATA_KEY]: metadata,
    },
  };
}

export function getBatteryIncludedCategoryStaticCount(category: Category): number | undefined {
  return getBatteryIncludedCategoryMetadata(category)?.count;
}
