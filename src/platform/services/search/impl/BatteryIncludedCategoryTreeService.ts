import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedShopApi } from '@/platform/integrations/batteryincluded/shop/BatteryIncludedShopApi';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Category } from '@/platform/services/model/category';
import type { BatteryIncludedCategoryTreeService as BatteryIncludedCategoryTreeServiceContract } from '@/platform/services/search/BatteryIncludedCategoryTreeService';
import type { CatalogPublishedRootCategoryService } from '../../catalog/impl/CatalogPublishedRootCategoryService';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '../../model/category/batteryincluded-category';
import {
  type BatteryIncludedCategoryTreeSnapshot,
  type NavigationCategoryTreeRequestContext,
  buildBatteryIncludedCategoryTree,
} from './batteryincluded-category-tree';

const COUNTRY_NONE_BUCKET = '__none__';

function buildCacheKey(context: NavigationCategoryTreeRequestContext): string {
  return `${context.siteCode}:${context.locale}:${context.country ?? COUNTRY_NONE_BUCKET}`;
}

@injectable('BatteryIncludedCategoryTreeService', 'Singleton')
class BatteryIncludedCategoryTreeService implements BatteryIncludedCategoryTreeServiceContract {
  private readonly cache = new Map<string, Promise<BatteryIncludedCategoryTreeSnapshot | null>>();

  constructor(
    @inject('BatteryIncludedShopApi') private readonly shopApi: BatteryIncludedShopApi,
    @inject('CatalogPublishedRootCategoryService')
    private readonly catalogPublishedRootCategoryService: CatalogPublishedRootCategoryService,
    @inject('CategoryService') private readonly categoryService: CategoryService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async getSnapshot(
    context: NavigationCategoryTreeRequestContext,
  ): Promise<BatteryIncludedCategoryTreeSnapshot | null> {
    const key = buildCacheKey(context);
    const cached = this.cache.get(key);
    if (cached) {
      this.logger.debug({ cacheKey: key }, 'BatteryIncluded category tree cache hit');
      return cached;
    }

    this.logger.debug({ cacheKey: key }, 'BatteryIncluded category tree cache miss');
    const pending = this.loadSnapshot(context).catch((error) => {
      this.cache.delete(key);
      this.logger.warn({ err: error, cacheKey: key }, 'BatteryIncluded category tree bootstrap failed');
      return null;
    });
    this.cache.set(key, pending);

    const snapshot = await pending;
    if (!snapshot) {
      this.cache.delete(key);
    }
    return snapshot;
  }

  private async loadSnapshot(
    context: NavigationCategoryTreeRequestContext,
  ): Promise<BatteryIncludedCategoryTreeSnapshot | null> {
    const publishedRootIds = await this.catalogPublishedRootCategoryService.getRootCategoryIdsForSite(context.siteCode);
    if (publishedRootIds.length === 0) {
      this.logger.info({ siteCode: context.siteCode }, 'BatteryIncluded category tree skipped: no published roots');
      return null;
    }

    const response = await this.shopApi.browseCategoryTreeBootstrap<unknown>({
      locale: context.locale,
      siteCode: context.siteCode,
      country: context.country,
    });

    const built = buildBatteryIncludedCategoryTree(
      response,
      publishedRootIds,
      context.locale,
      BATTERY_INCLUDED_BREADCRUMB_FILTER,
    );

    if (built.discardedRows.length > 0) {
      this.logger.warn(
        { siteCode: context.siteCode, discardedRows: built.discardedRows },
        'BatteryIncluded category tree discarded malformed or unpublished breadcrumb rows',
      );
    }
    if (built.validationWarnings.length > 0) {
      this.logger.warn(
        { siteCode: context.siteCode, validationWarnings: built.validationWarnings },
        'BatteryIncluded category tree categoryIds validation mismatch',
      );
    }
    if (!built.snapshot) {
      this.logger.warn({ siteCode: context.siteCode }, 'BatteryIncluded category tree bootstrap unusable');
      return null;
    }

    const allIds = Object.keys(built.snapshot.byId);
    if (allIds.length > 0) {
      try {
        const enrichedCategories = await this.categoryService.getCategoriesByIds(allIds, {
          showRoots: false,
          showUnpublished: false,
        });
        const descriptionsById = new Map<string, any>();
        enrichedCategories.forEach((c) => {
          if (c.description) {
            descriptionsById.set(c.id, c.description);
          }
        });

        const enrichNode = (node: Category | string) => {
          if (typeof node === 'string') return;
          const desc = descriptionsById.get(node.id);
          if (desc) {
            node.description = desc;
          }
          if (node.children) {
            node.children.forEach(enrichNode);
          }
        };

        built.snapshot.roots.forEach(enrichNode);
      } catch (err) {
        this.logger.warn(
          { err, siteCode: context.siteCode },
          'Failed to enrich BatteryIncluded category trees with descriptions',
        );
      }
    }

    return built.snapshot;
  }
}

export default BatteryIncludedCategoryTreeService;
