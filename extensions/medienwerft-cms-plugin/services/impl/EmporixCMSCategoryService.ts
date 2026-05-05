import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Category } from '@/platform/services/model/category';
import type { CatalogPublishedRootCategoryService } from '@/platform/services/search/impl/CatalogPublishedRootCategoryService';
import type { EmporixCmsCategoryApi } from '../../integrations/EmporixCmsCategoryApi';
import type EmporixCmsCategoryMapper from '../../integrations/impl/EmporixCmsCategoryMapper';
import type { CMSCategoryService } from '../CMSCategoryService';

/**
 * Emporix-backed implementation of the CMS plugin's `CMSCategoryService`.
 *
 * Composes the v2-aware `EmporixCmsCategoryApi` + `EmporixCmsCategoryMapper`
 * and the platform's `CatalogPublishedRootCategoryService`. Slug/code/id
 * lookups go through `EmporixCmsCategoryApi.getCategories` (v2 query
 * format) so they understand `localizedSlug`/`localizedName`.
 */
@injectable('CMSCategoryService', 'Singleton')
export class EmporixCMSCategoryService implements CMSCategoryService {
  constructor(
    @inject('EmporixCmsCategoryApi') private readonly cmsCategoryApi: EmporixCmsCategoryApi,
    @inject('EmporixCmsCategoryMapper') private readonly cmsCategoryMapper: EmporixCmsCategoryMapper,
    @inject('CatalogPublishedRootCategoryService')
    private readonly catalogRootService: CatalogPublishedRootCategoryService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async getCategoryByIdentifier(identifier: string): Promise<Category | null> {
    if (!identifier) return null;

    const bySlug = await this.findOne({ localizedSlug: identifier });
    if (bySlug) return bySlug;

    const byCode = await this.findOne({ code: identifier });
    if (byCode) return byCode;

    return this.fetchById(identifier);
  }

  getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<Category | null> {
    return this.fetchTree(categoryId, showUnpublished);
  }

  async getCategoryTreesForSite(site: string, showUnpublished?: boolean): Promise<Category[]> {
    try {
      const rootIds = await this.catalogRootService.getRootCategoryIdsForSite(site);
      if (rootIds.length === 0) {
        return [];
      }
      const trees = await Promise.all(rootIds.map((id) => this.fetchTree(id, showUnpublished)));
      return trees.filter((tree): tree is Category => tree !== null);
    } catch (error) {
      this.logger.error({ err: error, site }, 'Error fetching category trees for site');
      return [];
    }
  }

  private async findOne(query: { localizedSlug?: string; code?: string }): Promise<Category | null> {
    try {
      const response = await this.cmsCategoryApi.getCategories(query);
      if (!response.items || response.items.length === 0) {
        return null;
      }
      return this.cmsCategoryMapper.mapToService(response.items[0]);
    } catch (error) {
      this.logger.error({ err: error, query }, 'Error finding category by query');
      return null;
    }
  }

  private async fetchById(id: string): Promise<Category | null> {
    try {
      const category = await this.cmsCategoryApi.getCategory(id);
      return category ? this.cmsCategoryMapper.mapToService(category) : null;
    } catch (error) {
      this.logger.error({ err: error, categoryId: id }, 'Error fetching category by id');
      return null;
    }
  }

  private async fetchTree(categoryId: string, showUnpublished?: boolean): Promise<Category | null> {
    try {
      const tree = await this.cmsCategoryApi.getCategoryTree(categoryId, showUnpublished);
      if (!tree) return null;
      return this.cmsCategoryMapper.mapToService(tree);
    } catch (error) {
      this.logger.error({ err: error, categoryId }, 'Error fetching category tree');
      return null;
    }
  }
}

export default EmporixCMSCategoryService;
