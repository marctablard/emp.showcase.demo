import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import { ContentSiteResolver } from '@/platform/services/contentsites/ContentSiteResolver';
import type { ContentSitesService } from '@/platform/services/contentsites/ContentSitesService';
import type { Paginated } from '@/platform/services/model/common';
import type { SessionService } from '@/platform/services/session/SessionService';
import { getRequestSite } from '@/site/server/RequestSiteCache';
import type { ContentItem, ContentItemQuery, ContentItemsService } from '../ContentItemsService';

const CONTENTITEMS_ENTITY_TYPE = 'CONTENTITEMS';

@injectable('ContentItemsService', 'Singleton')
export class EmporixContentItemsService implements ContentItemsService {
  constructor(
    @inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi,
    @inject('SessionService') private sessionService: SessionService,
    @inject('ContentSitesService') private contentSitesService: ContentSitesService,
  ) {}

  private mapFromCustomEntity(entity: EmporixCustomEntity): ContentItem {
    return {
      id: entity.id!,
      name: entity.name || {},
      media: (entity as any).media || [],
      mixins: {
        style: (entity.mixins?.style as any) || {},
        relations: (entity.mixins?.relations as any) || {},
        content: (entity.mixins?.content as any) || {},
      },
      metadata: entity.metadata || {},
    };
  }

  /**
   * Resolve the active site code and translate it to a CONTENTSITE entity id.
   * ContentItems link to CONTENTSITES by entity id (auto-generated), not by site code.
   * Priority: explicit siteId → route [site] segment → session → env default.
   */
  private async resolveSiteId(explicitSiteId?: string): Promise<string | undefined> {
    if (explicitSiteId) return explicitSiteId;

    let siteCode: string | undefined;

    try {
      const routeSite = getRequestSite();
      if (routeSite) siteCode = routeSite;
    } catch {
      // ignore
    }

    if (!siteCode) {
      const session = await this.sessionService.getCurrent();
      if (session?.siteCode) siteCode = session.siteCode;
    }

    if (!siteCode) {
      siteCode = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
    }

    const siteId = await ContentSiteResolver.getContentSiteIdBySiteCode(siteCode!, this.contentSitesService);
    return siteId || undefined;
  }

  private buildQueryString(query: ContentItemQuery): string {
    const conditions: string[] = [];

    if (query.siteId) {
      conditions.push(`mixins.relations.contentsites.id:${query.siteId}`);
    }
    if (query.pageId) {
      conditions.push(`mixins.relations.contentpages.id:${query.pageId}`);
    }
    if (query.productId) {
      conditions.push(`mixins.relations.products.id:${query.productId}`);
    }
    if (query.categoryId) {
      conditions.push(`mixins.relations.categories.id:${query.categoryId}`);
    }

    return conditions.join(' AND ');
  }

  async getContentItems(query: ContentItemQuery): Promise<Paginated<ContentItem>> {
    const siteId = await this.resolveSiteId(query.siteId);
    const resolvedQuery: ContentItemQuery = { ...query, siteId };
    const queryString = this.buildQueryString(resolvedQuery);
    const sort = query.sort || 'metadata.modifiedAt:desc';

    const searchParams: any = {
      page: query.page ?? 0,
      size: query.size ?? 10,
      query: queryString,
      sort,
    };

    const response = await this.schemaApi.getCustomEntities(CONTENTITEMS_ENTITY_TYPE, searchParams);

    // Server-side Lucene query may not work when relation fields are stored as arrays.
    // Fall back to fetching all items and filtering client-side.
    if (response.items.length === 0 && (siteId || query.pageId || query.productId || query.categoryId)) {
      const allItemsResponse = await this.schemaApi.getCustomEntities(CONTENTITEMS_ENTITY_TYPE, {
        page: 0,
        size: 1000,
        sort,
      } as any);

      const filteredItems = allItemsResponse.items.filter((entity) => {
        const relations = (entity.mixins as any)?.relations || {};

        if (siteId) {
          const contentsites = relations.contentsites;
          const matches = Array.isArray(contentsites)
            ? contentsites.some((s: any) => s?.id === siteId)
            : contentsites?.id === siteId;
          if (!matches) return false;
        }

        if (query.pageId) {
          const contentpages = relations.contentpages;
          const matches = Array.isArray(contentpages)
            ? contentpages.some((p: any) => p?.id === query.pageId)
            : contentpages?.id === query.pageId;
          if (!matches) return false;
        }

        if (query.productId) {
          const products = relations.products;
          const matches = Array.isArray(products)
            ? products.some((p: any) => p?.id === query.productId)
            : products?.id === query.productId;
          if (!matches) return false;
        }

        if (query.categoryId) {
          const categories = relations.categories;
          const matches = Array.isArray(categories)
            ? categories.some((c: any) => c?.id === query.categoryId)
            : categories?.id === query.categoryId;
          if (!matches) return false;
        }

        return true;
      });

      const page = query.page ?? 0;
      const size = query.size ?? 10;
      const start = page * size;

      return {
        items: filteredItems.slice(start, start + size).map((e) => this.mapFromCustomEntity(e)),
        page,
        pageSize: size,
        total: filteredItems.length,
      };
    }

    return {
      items: response.items.map((e) => this.mapFromCustomEntity(e)),
      page: response.page,
      pageSize: response.size,
      total: response.total,
    };
  }

  async getContentItem(id: string): Promise<ContentItem | null> {
    const entity = await this.schemaApi.getCustomEntity(CONTENTITEMS_ENTITY_TYPE, id);
    if (!entity) return null;
    return this.mapFromCustomEntity(entity);
  }
}

export default EmporixContentItemsService;
