import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCatalogApi } from '@/platform/integrations/emporix/catalog/EmporixCatalogApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { isConfiguredStorefrontSiteCode } from '@/site/is-configured-storefront-site';

function resolveCacheTtlMs(): number {
  const raw = process.env.CATALOG_ROOT_CATEGORY_CACHE_TTL_SECONDS;
  if (raw === undefined || raw === '') {
    return 10 * 60 * 1000;
  }
  const sec = parseInt(raw, 10);
  if (!Number.isFinite(sec) || sec <= 0) {
    return 10 * 60 * 1000;
  }
  return sec * 1000;
}

type CacheEntry = {
  ids: string[];
  expiresAt: number;
};

/**
 * Resolves union of catalog root category IDs for a published site, with in-memory TTL cache.
 */
@injectable('CatalogPublishedRootCategoryService', 'Singleton')
export class CatalogPublishedRootCategoryService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = resolveCacheTtlMs();

  constructor(
    @inject('EmporixCatalogApi') private readonly catalogApi: EmporixCatalogApi,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async getRootCategoryIdsForSite(siteCode: string): Promise<string[]> {
    if (!isConfiguredStorefrontSiteCode(siteCode)) {
      this.logger.debug(
        { siteCode },
        'Skipping catalog lookup: site code is not a configured storefront site (avoid bogus publishedSite)',
      );
      return [];
    }

    const now = Date.now();
    const cached = this.cache.get(siteCode);
    if (cached && cached.expiresAt > now) {
      return cached.ids;
    }

    try {
      const ids = await this.fetchUnionRootCategoryIds(siteCode);
      this.cache.set(siteCode, { ids, expiresAt: now + this.ttlMs });
      return ids;
    } catch (error) {
      this.logger.warn(
        { err: error, siteCode },
        'Failed to load catalogs for published site; catalog-scoped search will return no products',
      );
      return [];
    }
  }

  private async fetchUnionRootCategoryIds(siteCode: string): Promise<string[]> {
    const union = new Set<string>();
    const pageSize = 100;
    let page = 1;

    while (true) {
      const catalogs = await this.catalogApi.getCatalogs({
        page,
        size: pageSize,
        criteria: {
          publishedSite: siteCode,
        },
      });

      for (const catalog of catalogs.items) {
        const roots = catalog.categoryIds;
        if (!roots?.length) {
          continue;
        }
        for (const id of roots) {
          const trimmed = id?.trim();
          if (trimmed) {
            union.add(trimmed);
          }
        }
      }

      if (catalogs.items.length < pageSize) {
        break;
      }
      page += 1;
    }

    return [...union];
  }
}

export default CatalogPublishedRootCategoryService;
