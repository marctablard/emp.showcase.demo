import type {
  BatteryIncludedCategoryTreeSnapshot,
  NavigationCategoryTreeRequestContext,
} from './impl/batteryincluded-category-tree';

export interface BatteryIncludedCategoryTreeService {
  getSnapshot(context: NavigationCategoryTreeRequestContext): Promise<BatteryIncludedCategoryTreeSnapshot | null>;
}
