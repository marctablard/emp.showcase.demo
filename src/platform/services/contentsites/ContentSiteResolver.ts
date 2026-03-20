import { getRequestSite } from '@/site/server/RequestSiteCache';
import type { SessionService } from '../session/SessionService';
import type { ContentSitesService } from './ContentSitesService';

/**
 * Resolves the CONTENTSITE entity id from the current site code.
 *
 * CONTENTSITE entities have an auto-generated id and carry the site code in name.en.
 * ContentItems link to CONTENTSITES via their entity id, so we must look up
 * the entity to translate siteCode → CONTENTSITE entity id.
 */
export class ContentSiteResolver {
  private static cache: Map<string, string> = new Map();

  /**
   * Translate a site code to the corresponding CONTENTSITE entity id.
   * Queries CONTENTSITES where name.en === siteCode.
   */
  static async getContentSiteIdBySiteCode(
    siteCode: string,
    contentSitesService: ContentSitesService,
  ): Promise<string | null> {
    if (this.cache.has(siteCode)) {
      return this.cache.get(siteCode) || null;
    }

    try {
      const result = await contentSitesService.getContentSites({ name: siteCode, size: 10 });
      const exactMatch = result.items.find((item) => item.name?.en === siteCode);

      if (exactMatch) {
        this.cache.set(siteCode, exactMatch.id);
        return exactMatch.id;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve the current CONTENTSITE entity id from request context.
   * Priority: route [site] URL segment → session siteCode → NEXT_PUBLIC_DEFAULT_SITE
   */
  static async getCurrentContentSiteId(
    sessionService: SessionService,
    contentSitesService: ContentSitesService,
  ): Promise<string | null> {
    let siteCode: string | undefined;

    try {
      siteCode = getRequestSite();
    } catch {
      // ignore
    }

    if (!siteCode) {
      const session = await sessionService.getCurrent();
      if (session?.siteCode) {
        siteCode = session.siteCode;
      }
    }

    if (!siteCode) {
      siteCode = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
    }

    if (!siteCode) return null;

    return this.getContentSiteIdBySiteCode(siteCode, contentSitesService);
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static clearCacheForSite(siteCode: string): void {
    this.cache.delete(siteCode);
  }
}
