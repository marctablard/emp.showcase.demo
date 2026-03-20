import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { Paginated } from '@/platform/services/model/common';
import type { ContentPage, ContentPageQuery, ContentPagesService } from '../ContentPagesService';

const CONTENTPAGES_ENTITY_TYPE = 'CONTENTPAGES';

@injectable('ContentPagesService', 'Singleton')
export class EmporixContentPagesService implements ContentPagesService {
  constructor(@inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi) {}

  private mapFromCustomEntity(entity: EmporixCustomEntity): ContentPage {
    return {
      id: entity.id!,
      name: entity.name || {},
      metadata: entity.metadata || {},
    };
  }

  private buildQueryString(query: ContentPageQuery): string {
    if (query.name) {
      return `name.en:${query.name}`;
    }
    return '';
  }

  async getContentPages(query: ContentPageQuery): Promise<Paginated<ContentPage>> {
    const queryString = this.buildQueryString(query);

    const searchParams: any = {
      page: query.page ?? 0,
      size: query.size ?? 10,
      query: queryString,
    };

    const response = await this.schemaApi.getCustomEntities(CONTENTPAGES_ENTITY_TYPE, searchParams);

    return {
      items: response.items.map((entity) => this.mapFromCustomEntity(entity)),
      page: response.page,
      pageSize: response.size,
      total: response.total,
    };
  }

  async getContentPage(id: string): Promise<ContentPage | null> {
    const entity = await this.schemaApi.getCustomEntity(CONTENTPAGES_ENTITY_TYPE, id);
    if (!entity) {
      return null;
    }
    return this.mapFromCustomEntity(entity);
  }
}

export default EmporixContentPagesService;
