import { inject } from 'inversify';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSNoResult, CMSPage } from '../../model/cms';
import type { SessionService } from '../../session';

/**
 * Legacy CMSService implementation that loaded content from local JSON
 * files. Kept temporarily as dead code: the DI decorator was removed so
 * the container no longer binds it. New CMS resolution flows through
 * `DelegatingCmsServiceSSR` + `LocalJsonCmsAdapter`.
 *
 * Scheduled for removal in the next CMS-layout slice.
 */
export class LocalCmsServiceSSR {
  private defaultSite: string;
  private sessionService: SessionService;
  private logger: LoggerService;

  /**
   * Constructor
   * @param defaultSite Default site to use as fallback (default: '_default_')
   */
  constructor(
    @inject('SessionService') sessionService: SessionService,
    @inject('LoggerService') logger: LoggerService,
    defaultSite: string = '_default_',
  ) {
    this.defaultSite = defaultSite;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  /**
   * Get a page from CMS using the folder structure cms/[site]/[language]/slug.json
   * Falls back to _default_ site if the requested site doesn't have the content
   * @param slug The page slug
   * @param locale The locale (language code)
   * @param site The site identifier
   * @returns Promise with the page or CMSNoResult if not found
   */
  async getPage(slug: string, locale: string, _site: string): Promise<CMSPage | CMSNoResult> {
    try {
      // Normalize the slug to create a valid filename
      const normalizedSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
      const normalizedLocale = locale.toLowerCase();

      const session = await this.sessionService.getCurrent();

      const normalizedSite = session && session.siteCode ? session.siteCode : this.defaultSite;

      // Try to get the page from the requested site
      let pageData = await this.tryLoadPage(normalizedSlug, normalizedLocale, normalizedSite);

      // If not found and site is not the default site, try the default site
      if ('notfound' in pageData && normalizedSite !== this.defaultSite) {
        this.logger.info(
          {
            slug,
            site: normalizedSite,
          },
          `Page '${slug}' not found for site '${normalizedSite}', trying default site`,
        );
        pageData = await this.tryLoadPage(normalizedSlug, normalizedLocale, this.defaultSite);
      }

      return pageData;
    } catch (_error) {
      this.logger.warn({ slug }, `Error loading CMS page with slug '${slug}`);
      return {
        notfound: true,
        message: `Error loading page with slug '${slug}'`,
      };
    }
  }

  /**
   * Try to load a page from a specific path
   * @param slug Normalized slug
   * @param locale Normalized locale
   * @param site Normalized site
   * @returns CMSPage if found, CMSNoResult if not found
   */
  private async tryLoadPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult> {
    try {
      // Attempt to dynamically import the JSON file (necessary for Next.js server to pick it up as needed path Resource)
      const pageData = await import(`../../../../data/cms/${site}/${locale}/${slug}.json`)
        .then((module) => module.default as CMSPage)
        .catch(() => null);

      if (!pageData) {
        return {
          notfound: true,
          message: `Page with slug '${slug}' not found for site '${site}' and locale '${locale}'`,
        };
      }

      return pageData;
    } catch (_error) {
      this.logger.warn({ slug }, `Error dynamically importing CMS data for slug '${slug}`);
      return {
        notfound: true,
        message: `Error loading page with slug '${slug}'`,
      };
    }
  }
}

export default LocalCmsServiceSSR;
