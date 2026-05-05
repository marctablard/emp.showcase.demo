import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { CMSComponent, CMSNoResult } from '@/platform/services/model/cms';
import type { EmporixCmsApi } from '../../integrations/EmporixCmsApi';
import { tryLoadWithFallbacks } from '../../lib/try-load-with-fallbacks';
import { CMSLayout, CMSPage } from '../../types';
import type { CMSComponentDecoratorContext, CMSComponentDecoratorService } from '../CMSComponentDecoratorService';
import type { CMSSiteFallback } from '../CMSSettingsService';
import type { GetLayoutOptions, GetPageOptions, EmporixCMSService as IEmporixCMSService } from '../EmporixCMSService';

/**
 * Implementation of CMSService backed by the EmporixCmsApi.
 *
 * This service contains only CMS business logic (slug normalisation,
 * site fallback, session-based site resolution). All Emporix-specific
 * integration details live in the EmporixCmsApi layer.
 */
@injectable('EmporixCMSService', 'Singleton')
export class EmporixCMSService implements IEmporixCMSService {
  private cmsApi: EmporixCmsApi;
  private logger: LoggerService;
  private decorator: CMSComponentDecoratorService;

  constructor(
    @inject('EmporixCmsApi') cmsApi: EmporixCmsApi,
    @inject('LoggerService') logger: LoggerService,
    @inject('EmporixCMSComponentDecoratorService')
    decorator: CMSComponentDecoratorService,
  ) {
    this.cmsApi = cmsApi;
    this.logger = logger;
    this.decorator = decorator;
  }

  /**
   * Get a page from CMS.
   *
   * Applies the full fallback matrix from
   * {@link tryLoadWithFallbacks}: exact tuple → draft-to-live → locale
   * swap → site swap → both swapped. The caller supplies the fallback
   * tuple itself (typically via `CMSSettingsService.getSiteFallback`),
   * so hard-coded per-site defaults never leak into this layer.
   *
   * `fallbackOrOptions` accepts either the legacy `{ site, locale }`
   * shape or a rich {@link GetPageOptions} bag.
   */
  async getPage(
    slug: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    fallbackOrOptions?: CMSSiteFallback | GetPageOptions,
  ): Promise<CMSPage | CMSNoResult> {
    const { fallback, loadLayout } = normalizeGetPageArgs(fallbackOrOptions);
    const apiOptions = { loadLayout };
    try {
      const normalizedSlug = slug.replace(/[^a-zA-Z0-9\-_/]/g, '').toLowerCase();
      const normalizedLocale = locale.toLowerCase();

      const pageData = await tryLoadWithFallbacks<CMSPage>(
        (loc, s, v) => this.cmsApi.getPage(normalizedSlug, loc, s, v, apiOptions),
        { locale: normalizedLocale, site, version, fallback },
      );

      if (!pageData) {
        return {
          notfound: true,
          message: `Page with slug '${slug}' not found`,
        };
      }

      // Enrich each component with server-resolved extras (e.g. category trees)
      // so client components can render straight from the payload.
      return await this.decoratePage(pageData, { site, locale: normalizedLocale });
    } catch (err) {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err), slug, site, version },
        `Error loading CMS page with slug '${slug}'`,
      );
      return {
        notfound: true,
        message: `Error loading page with slug '${slug}'`,
      };
    }
  }

  /**
   * Load a layout by id, decorate its components, and return it.
   *
   * Supports the same fallback matrix as {@link getPage} via
   * `options.fallback` so layouts missing on a non-default site can
   * gracefully resolve to the shared site/locale.
   */
  async getLayout(
    layoutId: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    options?: GetLayoutOptions,
  ): Promise<CMSLayout | CMSNoResult> {
    try {
      const normalizedLocale = locale.toLowerCase();
      const layout = await tryLoadWithFallbacks<CMSLayout>((loc, s, v) => this.cmsApi.getLayout(layoutId, loc, s, v), {
        locale: normalizedLocale,
        site,
        version,
        fallback: options?.fallback,
      });

      if (!layout) {
        return {
          notfound: true,
          message: `Layout with id '${layoutId}' not found`,
        };
      }

      return await this.decorateLayout(layout, { site, locale: normalizedLocale });
    } catch (err) {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err), layoutId, site, version },
        `Error loading CMS layout with id '${layoutId}'`,
      );
      return {
        notfound: true,
        message: `Error loading layout with id '${layoutId}'`,
      };
    }
  }

  /**
   * Run every component on the page (both the flat `components` list and the
   * per-slot `contentSlots` buckets) through the decorator service. Failures
   * for individual components are swallowed by the decorator itself so the
   * page is always returned in a usable shape.
   */
  private async decoratePage(page: CMSPage, ctx: CMSComponentDecoratorContext): Promise<CMSPage> {
    const [components, contentSlots] = await Promise.all([
      this.decorateList(page.components, ctx),
      this.decorateSlotRecord(page.contentSlots, ctx),
    ]);
    return { ...page, components, contentSlots };
  }

  /**
   * Mirror of {@link decoratePage} for standalone layouts: decorates the
   * per-slot `components` record.
   */
  private async decorateLayout(layout: CMSLayout, ctx: CMSComponentDecoratorContext): Promise<CMSLayout> {
    const components = await this.decorateSlotRecord(layout.components, ctx);
    return { ...layout, components };
  }

  private decorateList(list: CMSComponent[] | undefined, ctx: CMSComponentDecoratorContext): Promise<CMSComponent[]> {
    return Promise.all((list ?? []).map((c) => this.decorator.decorate(c, ctx)));
  }

  private async decorateSlotRecord(
    slots: Record<string, CMSComponent[]> | undefined,
    ctx: CMSComponentDecoratorContext,
  ): Promise<Record<string, CMSComponent[]>> {
    const entries = await Promise.all(
      Object.entries(slots ?? {}).map(
        async ([slotId, comps]) => [slotId, await this.decorateList(comps, ctx)] as const,
      ),
    );
    const out: Record<string, CMSComponent[]> = {};
    for (const [slotId, comps] of entries) out[slotId] = comps;
    return out;
  }
}

/**
 * Split the legacy-or-options argument into a normalized shape. Any object
 * with `loadLayout` or `fallback` is treated as {@link GetPageOptions};
 * anything else falls back to the legacy `{ site?, locale? }` shape.
 */
function normalizeGetPageArgs(arg: CMSSiteFallback | GetPageOptions | undefined): {
  fallback?: CMSSiteFallback;
  loadLayout?: boolean;
} {
  if (!arg) return {};
  if ('loadLayout' in arg || 'fallback' in arg) {
    const opts = arg as GetPageOptions;
    return { fallback: opts.fallback, loadLayout: opts.loadLayout };
  }
  return { fallback: arg as CMSSiteFallback };
}

export default EmporixCMSService;
