import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { Paginated } from '@/platform/services/model/common';
import type { ContentSite, ContentSiteQuery, ContentSitesService } from '../ContentSitesService';

const CONTENTSITES_ENTITY_TYPE = 'CONTENTSITES';

@injectable('ContentSitesService', 'Singleton')
export class EmporixContentSitesService implements ContentSitesService {
  constructor(@inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi) {}

  private mapFromCustomEntity(entity: EmporixCustomEntity): ContentSite {
    return {
      id: entity.id!,
      name: entity.name || {},
      media: (entity as any).media || [],
      mixins: {
        sitestyle: (entity.mixins?.sitestyle as any) || {},
        producthighlights: (entity.mixins?.producthighlights as any) || {},
      },
      metadata: entity.metadata || {},
    };
  }

  private buildQueryString(query: ContentSiteQuery): string {
    if (query.name) {
      return `name.en:${query.name}`;
    }
    return '';
  }

  async getContentSites(query: ContentSiteQuery): Promise<Paginated<ContentSite>> {
    const queryString = this.buildQueryString(query);

    const searchParams: any = {
      page: query.page ?? 0,
      size: query.size ?? 10,
      query: queryString,
    };

    const response = await this.schemaApi.getCustomEntities(CONTENTSITES_ENTITY_TYPE, searchParams);

    return {
      items: response.items.map((entity) => this.mapFromCustomEntity(entity)),
      page: response.page,
      pageSize: response.size,
      total: response.total,
    };
  }

  async getContentSite(id: string): Promise<ContentSite | null> {
    const entity = await this.schemaApi.getCustomEntity(CONTENTSITES_ENTITY_TYPE, id);
    if (!entity) {
      return null;
    }
    return this.mapFromCustomEntity(entity);
  }
}

export default EmporixContentSitesService;
