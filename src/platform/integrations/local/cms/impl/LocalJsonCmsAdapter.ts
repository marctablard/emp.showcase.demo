import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { CmsAdapter } from '@/platform/services/cms/CmsAdapter';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSNavigation, CMSNoResult, CMSPage } from '@/platform/services/model/cms';
import type { SessionService } from '@/platform/services/session';

/**
 * Strategy for loading local-JSON CMS page data.
 *
 * Production binds the default loader (`defaultJsonLoader`) which uses a
 * webpack/Next dynamic `import()` against `src/data/cms/<site>/<locale>/<slug>.json`.
 * Tests inject a fake loader — no on-disk fixtures required.
 *
 * The loader resolves to the parsed JSON or `null` when the file does not
 * exist. The loader MUST NOT throw for missing files; throwing is reserved
 * for genuine I/O failures (which `LocalJsonCmsAdapter` then surfaces as
 * `{ notfound: true }` via its try/catch).
 */
export type CmsDataLoader = (site: string, locale: string, slug: string) => Promise<unknown | null>;

const defaultJsonLoader: CmsDataLoader = (site, locale, slug) =>
  import(`../../../../../data/cms/${site}/${locale}/${slug}.json`).then((m) => m.default).catch(() => null);

const FALLBACK_DEFAULT_SITE = '_default_';

function readDefaultSiteFromEnv(): string {
  const raw = process.env.NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE;
  if (typeof raw !== 'string') return FALLBACK_DEFAULT_SITE;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_DEFAULT_SITE;
}

/**
 * `CmsAdapter` backed by version-controlled JSON under `src/data/cms/`.
 *
 * Folder layout (relative to repo root): `src/data/cms/<site>/<locale>/<slug>.json`.
 *
 * Resolution flow per `getPage` call:
 *  1. Determine the site: prefer the current session's `siteCode`,
 *     otherwise fall back to the configured default site.
 *  2. Normalize the slug (drop disallowed chars, lowercase) and locale
 *     (lowercase). The `site`-argument to `getPage` is informational only —
 *     the session is the source of truth for the active site.
 *  3. Ask the loader for the site/locale/slug triple.
 *  4. If that returns `null` AND the resolved site differs from the
 *     default, retry the loader with the default site.
 *  5. Loader errors are caught and surfaced as `{ notfound: true }` — the
 *     adapter never throws.
 */
@injectable('CmsAdapter:local', 'Singleton')
export class LocalJsonCmsAdapter implements CmsAdapter {
  readonly id = 'local';
  private readonly defaultSite: string;

  constructor(
    @inject('SessionService') private readonly sessionService: SessionService,
    @inject('LoggerService') private readonly logger: LoggerService,
    private readonly loader: CmsDataLoader = defaultJsonLoader,
    defaultSite?: string,
  ) {
    this.defaultSite = defaultSite ?? readDefaultSiteFromEnv();
  }

  hasContent(): boolean {
    return true;
  }

  async getPage(slug: string, locale: string, _site: string): Promise<CMSPage | CMSNoResult> {
    try {
      const normalizedSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
      const normalizedLocale = locale.toLowerCase();

      const session = await this.sessionService.getCurrent();
      const normalizedSite = session && session.siteCode ? session.siteCode : this.defaultSite;

      let pageData = await this.tryLoadPage(normalizedSlug, normalizedLocale, normalizedSite);

      if ('notfound' in pageData && normalizedSite !== this.defaultSite) {
        this.logger.info(
          { slug, site: normalizedSite },
          `Page '${slug}' not found for site '${normalizedSite}', trying default site`,
        );
        pageData = await this.tryLoadPage(normalizedSlug, normalizedLocale, this.defaultSite);
      }

      return pageData;
    } catch (_error) {
      this.logger.warn({ slug }, `Error loading CMS page with slug '${slug}'`);
      return {
        notfound: true,
        message: `Error loading page with slug '${slug}'`,
      };
    }
  }

  async getNavigation(_locale: string, _site: string): Promise<CMSNavigation | CMSNoResult> {
    return { notfound: true };
  }

  private async tryLoadPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult> {
    try {
      const pageData = await this.loader(site, locale, slug);

      if (!pageData) {
        return {
          notfound: true,
          message: `Page with slug '${slug}' not found for site '${site}' and locale '${locale}'`,
        };
      }

      return pageData as CMSPage;
    } catch (_error) {
      this.logger.warn({ slug }, `Error loading CMS data for slug '${slug}'`);
      return {
        notfound: true,
        message: `Error loading page with slug '${slug}'`,
      };
    }
  }
}

export default LocalJsonCmsAdapter;
