import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSComponent } from '@/platform/services/model/cms';
import { buildEntityId, canonicalUrl, parseVersionedId } from '../../lib/version-utils';
import type { CMSLayout, CMSPage } from '../../types';
import type { GetLayoutOptions, GetPageOptions, EmporixCmsApi as IEmporixCmsApi } from '../EmporixCmsApi';

/**
 * Cache TTL (Next fetch revalidate) applied to live CMS reads. Drafts and
 * archived versions are always uncached — editors need to see their changes
 * immediately. Override per-content-type via env:
 *   CMS_LIVE_PAGE_CACHE_SECONDS    — default 60
 *   CMS_LIVE_LAYOUT_CACHE_SECONDS  — default 60
 */
const DEFAULT_LIVE_CACHE_SECONDS = 60;

const parsePositiveInt = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const livePageCacheSeconds = (): number =>
  parsePositiveInt(process.env.CMS_LIVE_PAGE_CACHE_SECONDS) ?? DEFAULT_LIVE_CACHE_SECONDS;

const liveLayoutCacheSeconds = (): number =>
  parsePositiveInt(process.env.CMS_LIVE_LAYOUT_CACHE_SECONDS) ?? DEFAULT_LIVE_CACHE_SECONDS;

const isLiveVersion = (version: 'draft' | 'live' | string | undefined): boolean => !version || version === 'live';

/**
 * Emporix Custom Entities backed implementation of the CMS API.
 *
 * All Emporix-specific details (entity type, mixin key, ID convention,
 * entity-to-page mapping) live here so the service layer stays clean.
 */
@injectable('EmporixCmsApi', 'Singleton')
class EmporixCmsApi implements IEmporixCmsApi {
  private readonly PAGE_ENTITY_TYPE = 'STOREFRONT_CMS_PAGE';
  private readonly PAGE_MIXIN_KEY = 'CMS_PAGE_DATA';
  private readonly LAYOUT_ENTITY_TYPE = 'STOREFRONT_CMS_LAYOUT';
  private readonly LAYOUT_MIXIN_KEY = 'CMS_LAYOUT_DATA';

  constructor(
    @inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getPage(
    slug: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    options?: GetPageOptions,
  ): Promise<CMSPage | null> {
    const loadLayout = options?.loadLayout !== false;
    const cacheSeconds = isLiveVersion(version) ? livePageCacheSeconds() : undefined;
    try {
      // Build entity ID using canonical URL hash (matches editor-side convention)
      const url = canonicalUrl(slug);
      const entityId = buildEntityId('page', url, locale, site, version);
      let entity = await this.schemaApi.getCustomEntity(this.PAGE_ENTITY_TYPE, entityId, cacheSeconds);
      if (!entity) {
        // Fallback: search by mixin attributes. Lookup is by canonical `url`
        // (not `slug`) so storefront and editor agree on a single key.
        const searchResult = await this.schemaApi.searchCustomEntities(this.PAGE_ENTITY_TYPE, {
          criteria: {
            [`mixins.${this.PAGE_MIXIN_KEY}.url`]: url,
            [`mixins.${this.PAGE_MIXIN_KEY}.locale`]: locale,
            [`mixins.${this.PAGE_MIXIN_KEY}.site`]: site,
            [`mixins.${this.PAGE_MIXIN_KEY}.version`]: version,
          },
        });

        if (searchResult.items && searchResult.items.length > 0) {
          entity = searchResult.items[0];
        }
      }

      if (entity) {
        const mixin = entity.mixins?.[this.PAGE_MIXIN_KEY] as PageMixinPayload | undefined;
        const layoutId = mixin?.layout_id;
        const layout =
          loadLayout && layoutId ? ((await this.getLayout(layoutId, locale, site, version)) ?? undefined) : undefined;
        return this.mapEntityToPage(entity, layout);
      }

      return null;
    } catch (_error) {
      this.logger.warn({ slug }, `Error loading CMS entity for slug '${slug}'`);
      return null;
    }
  }

  async getLayout(
    layoutId: string,
    locale: string,
    site: string,
    version?: 'draft' | 'live' | string,
    _options?: GetLayoutOptions,
  ): Promise<CMSLayout | null> {
    const cacheSeconds = isLiveVersion(version) ? liveLayoutCacheSeconds() : undefined;
    try {
      // Try versioned/site-scoped id first (matches editor-side convention),
      // then fall back to the bare id for legacy entities.
      const versionedId = buildEntityId('layout', layoutId, locale, site, version);
      let entity = await this.schemaApi.getCustomEntity(this.LAYOUT_ENTITY_TYPE, versionedId, cacheSeconds);
      if (!entity) {
        entity = await this.schemaApi.getCustomEntity(this.LAYOUT_ENTITY_TYPE, layoutId, cacheSeconds);
      }
      if (!entity) {
        // Fallback: search by mixin attributes
        const searchResult = await this.schemaApi.searchCustomEntities(this.LAYOUT_ENTITY_TYPE, {
          criteria: {
            [`mixins.${this.LAYOUT_MIXIN_KEY}.id`]: layoutId,
            [`mixins.${this.LAYOUT_MIXIN_KEY}.locale`]: locale,
            [`mixins.${this.LAYOUT_MIXIN_KEY}.site`]: site,
            ...(version ? { [`mixins.${this.LAYOUT_MIXIN_KEY}.version`]: version } : {}),
          },
        });
        if (searchResult.items && searchResult.items.length > 0) {
          entity = searchResult.items[0];
        }
      }

      if (entity) {
        const mixinData = entity.mixins?.[this.LAYOUT_MIXIN_KEY] as LayoutMixinPayload | undefined;
        const layout: CMSLayout = {
          id: entity.id ?? '',
          name: mixinData?.name ?? '',
          base_id: mixinData?.base_id,
          components: parseJsonField(mixinData?.components_json, {}) as Record<string, CMSComponent[]>,
          contentSlots: parseJsonField(mixinData?.content_slots, []) as CMSLayout['contentSlots'],
          version: mixinData?.version ?? 'live',
        };
        return layout;
      }

      return null;
    } catch (_error) {
      this.logger.warn({ layoutId }, `Error loading CMS layout for id '${layoutId}'`);
      return null;
    }
  }

  /**
   * Map a CustomEntity instance to a CMSPage.
   * Parses the components_json field back into the components array.
   */
  private mapEntityToPage(entity: EmporixCustomEntity, layout?: CMSLayout): CMSPage | null {
    const mixin = entity.mixins?.[this.PAGE_MIXIN_KEY] as PageMixinPayload | undefined;
    if (!mixin) {
      this.logger.warn({ entityId: entity.id }, `Entity ${entity.id} does not have a ${this.PAGE_MIXIN_KEY} mixin`);
      return null;
    }

    // Parse placeholder-based content
    let pageComponents: Record<string, CMSComponent[]> | CMSComponent[] = [];
    if (mixin.components_json) {
      try {
        pageComponents =
          typeof mixin.components_json === 'string' ? JSON.parse(mixin.components_json) : mixin.components_json;
      } catch (_parseError) {
        this.logger.warn({ entityId: entity.id }, `Failed to parse components_json for entity '${entity.id}'`);
      }
    }
    // If no layout was found represent the content as a simple component list
    const components: CMSComponent[] = [];
    const contentSlots: Record<string, CMSComponent[]> = {};
    if (!layout || Object.values(layout.components).flat().length === 0) {
      // No layout - put all components in a default slot
      if (Array.isArray(pageComponents)) {
        components.push(...pageComponents);
        contentSlots['main'] = pageComponents;
      } else {
        // pageComponents is already a Record<string, CMSComponent[]>
        Object.assign(contentSlots, pageComponents);
        components.push(...Object.values(pageComponents).flat());
      }
    } else {
      layout.contentSlots.forEach((contentSlot) => {
        let componentsForSlot: CMSComponent[] = [];
        if (contentSlot.layout) {
          // add layout components
          componentsForSlot = layout.components[contentSlot.id] || [];
        } else {
          if (Array.isArray(pageComponents)) {
            componentsForSlot = pageComponents as CMSComponent[];
            pageComponents = []; // empty the array so it won't be used again
          } else {
            componentsForSlot = pageComponents[contentSlot.id] || [];
          }
        }
        // Populate contentSlots object
        contentSlots[contentSlot.id] = componentsForSlot;
        components.push(...componentsForSlot);
      });
    }

    // Parse version information from entity ID
    const { baseId, version: parsedVersion } = parseVersionedId(entity.id ?? '');

    return {
      id: entity.id ?? '',
      title: mixin.title || '',
      description: mixin.description || '',
      url: mixin.url || '',
      no_margin: mixin.no_margin === 'true',
      components,
      contentSlots,
      layout,
      site: mixin.site,
      locale: mixin.locale,
      version: mixin.version || parsedVersion,
      base_id: mixin.base_id || baseId,
      author: mixin.author,
    };
  }
}

/**
 * Local view of the `CMS_PAGE_DATA` mixin payload. Emporix stores mixin
 * values as a loose JSON object; this interface narrows the fields the
 * service actually reads so `mapEntityToPage` no longer leans on `any`.
 */
interface PageMixinPayload {
  title?: string;
  site: string;
  locale: string;
  description?: string;
  url?: string;
  no_margin?: string;
  components_json?: string | Record<string, CMSComponent[]> | CMSComponent[];
  layout_id?: string;
  version?: 'draft' | 'live' | string;
  base_id?: string;
  author?: string;
}

/** Narrow view of the `CMS_LAYOUT_DATA` mixin payload. */
interface LayoutMixinPayload {
  name?: string;
  base_id?: string;
  components_json?: string;
  content_slots?: string;
  version?: 'draft' | 'live' | string;
  author?: string;
}

/**
 * Parse a JSON-encoded mixin field with a defensive fallback. Used for
 * `components_json` / `content_slots`, both of which are stored as
 * TEXT JSON by the editor. Failing gracefully here keeps rendering
 * alive even if one row is corrupt.
 */
function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default EmporixCmsApi;
