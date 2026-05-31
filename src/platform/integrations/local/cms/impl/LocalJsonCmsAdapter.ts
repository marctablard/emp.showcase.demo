import { inject } from 'inversify';
import { LayoutContentSchema } from '@/components/cms/component-schema';
import { getCmsLocalDefaultSite } from '@/lib/server/cms-server-defaults';
import { injectable } from '@/platform/core/di/injectable';
import type { CmsAdapter } from '@/platform/services/cms/CmsAdapter';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSLayout, CMSNavigation, CMSNoResult, CMSPage } from '@/platform/services/model/cms';
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
    this.defaultSite = defaultSite ?? getCmsLocalDefaultSite();
  }

  hasContent(): boolean {
    return true;
  }

  async getPage(slug: string, locale: string, _site: string): Promise<CMSPage | CMSNoResult> {
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
  }

  /**
   * Loads a layout from `src/data/cms/<site>/<locale>/layouts/<layoutId>.json`.
   *
   * Mirrors `getPage`'s site-resolution and default-site fallback, then
   * validates the payload against `LayoutContentSchema` (which enforces the
   * single-`content-slot` invariant). A missing file or a validation failure
   * surfaces as `{ notfound: true }` — the page shell then renders the page
   * body directly. The adapter MUST NOT throw upward (SPI contract).
   */
  async getLayout(layoutId: string, locale: string, _site: string): Promise<CMSLayout | CMSNoResult> {
    const normalizedLayoutId = layoutId.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
    const normalizedLocale = locale.toLowerCase();
    const slug = `layouts/${normalizedLayoutId}`;

    const session = await this.sessionService.getCurrent();
    const normalizedSite = session && session.siteCode ? session.siteCode : this.defaultSite;

    let result = await this.tryLoadLayout(slug, normalizedLocale, normalizedSite, layoutId);

    if ('notfound' in result && normalizedSite !== this.defaultSite) {
      this.logger.info(
        { layoutId, site: normalizedSite },
        `Layout '${layoutId}' not found for site '${normalizedSite}', trying default site`,
      );
      result = await this.tryLoadLayout(slug, normalizedLocale, this.defaultSite, layoutId);
    }

    return result;
  }

  async getNavigation(_locale: string, _site: string): Promise<CMSNavigation | CMSNoResult> {
    return { notfound: true };
  }

  private async tryLoadLayout(
    slug: string,
    locale: string,
    site: string,
    layoutId: string,
  ): Promise<CMSLayout | CMSNoResult> {
    try {
      const layoutData = await this.loader(site, locale, slug);

      if (!layoutData) {
        return {
          notfound: true,
          message: `Layout '${layoutId}' not found for site '${site}' and locale '${locale}'`,
        };
      }

      const parsed = LayoutContentSchema.safeParse(layoutData);
      if (!parsed.success) {
        this.logger.warn({ layoutId, issues: parsed.error.issues }, `Layout '${layoutId}' failed schema validation`);
        return {
          notfound: true,
          message: `Layout '${layoutId}' failed schema validation`,
        };
      }

      return parsed.data as CMSLayout;
    } catch (_error) {
      this.logger.warn({ layoutId }, `Error loading layout '${layoutId}'`);
      return {
        notfound: true,
        message: `Error loading layout '${layoutId}'`,
      };
    }
  }

  /**
   * Single try/catch: the default loader (`defaultJsonLoader`) already swallows
   * its own `import()` rejection to `null` for missing files, so a thrown error
   * here is a genuine I/O / parse problem. Surface those as `{ notfound: true }`
   * — the adapter MUST NOT throw upward (SPI contract).
   */
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
