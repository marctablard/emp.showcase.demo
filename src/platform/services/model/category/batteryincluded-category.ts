import type { Category } from '@/platform/services/model/category';

export const BATTERY_INCLUDED_CATEGORY_METADATA_KEY = 'batteryIncludedCategory';
export const BATTERY_INCLUDED_BREADCRUMB_FILTER = '_product_i18n.categories.breadcrumbs.displayPath';

export interface BatteryIncludedCategoryMetadata {
  source: 'batteryincluded';
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
