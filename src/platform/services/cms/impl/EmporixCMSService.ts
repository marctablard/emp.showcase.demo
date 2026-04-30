import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { ContentItemsService } from '@/platform/services/contentitems/ContentItemsService';
import { ContentPageResolver } from '@/platform/services/contentpages/ContentPageResolver';
import type { ContentPagesService } from '@/platform/services/contentpages/ContentPagesService';
import { ContentSiteResolver } from '@/platform/services/contentsites/ContentSiteResolver';
import type { ContentSitesService } from '@/platform/services/contentsites/ContentSitesService';
import type { CMSNoResult, CMSPage } from '../../model/cms';
import type { CMSService } from '../CMSService';

/**
 * CMSService implementation backed by Emporix custom entities.
 *
 * Data model:
 *  - CONTENTSITES  — one entity per site; name.en = site code, id = auto-generated
 *  - CONTENTPAGES  — one entity per page type (home, product, search, category)
 *  - CONTENTITEMS  — content blocks linked to a CONTENTSITE and CONTENTPAGE via their entity ids
 */
@injectable('CMSService', 'Singleton')
export class EmporixCMSService implements CMSService {
  constructor(
    @inject('ContentItemsService') private contentItemsService: ContentItemsService,
    @inject('ContentPagesService') private contentPagesService: ContentPagesService,
    @inject('ContentSitesService') private contentSitesService: ContentSitesService,
  ) {}

  async getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult> {
    try {
      const pathname = slug ? `/${slug}` : '/';

      if (!site) {
        return { notfound: true, message: 'No site code provided' };
      }

      // Translate site code → CONTENTSITE entity id
      const siteId = await ContentSiteResolver.getContentSiteIdBySiteCode(site, this.contentSitesService);
      if (!siteId) {
        return { notfound: true, message: `CONTENTSITE not found for site '${site}'` };
      }

      const pageId = await ContentPageResolver.getContentPageIdFromPathname(pathname, this.contentPagesService);
      if (!pageId) {
        return { notfound: true, message: `CONTENTPAGE not found for pathname '${pathname}'` };
      }

      const contentItemsResponse = await this.contentItemsService.getContentItems({ siteId, pageId, size: 100 });

      if (contentItemsResponse.items.length === 0) {
        return { notfound: true, message: `No ContentItems found for page '${slug}' on site '${site}'` };
      }

      const components = contentItemsResponse.items.map((item) => {
        const displayType = item.mixins?.style?.display || 'hero';
        let componentType: string;
        switch (displayType) {
          case 'image left':
          case 'image right':
            componentType = 'content-item-media-text';
            break;
          case 'centered':
            componentType = 'content-item-centered';
            break;
          case 'hero':
          default:
            componentType = 'hero';
        }
        return { id: item.id, type: componentType, contentItem: item };
      });

      const firstItem = contentItemsResponse.items[0];
      const title =
        firstItem.name?.[locale] ||
        firstItem.name?.['en'] ||
        firstItem.name?.[Object.keys(firstItem.name || {})[0]] ||
        slug;

      return { title, description: '', url: pathname, components, no_margin: false };
    } catch {
      return { notfound: true, message: `Error loading Emporix CMS page '${slug}'` };
    }
  }
}

export default EmporixCMSService;
