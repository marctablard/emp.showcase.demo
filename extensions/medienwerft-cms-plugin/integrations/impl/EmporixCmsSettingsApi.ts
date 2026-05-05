import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type {
  EmporixCmsSettingsApi as IEmporixCmsSettingsApi,
  RawCmsSettings,
  RawSiteFallbackEntry,
} from '../EmporixCmsSettingsApi';

/**
 * TTL applied to the underlying Emporix read (seconds). See
 * `EmporixCmsThemeApi.THEME_TTL_SECONDS` for the rationale — same model.
 */
const SETTINGS_TTL_SECONDS = 300;

/**
 * Emporix Custom Entities-backed implementation of the CMS Settings API.
 *
 * The settings row is a single `STOREFRONT_CMS_SETTINGS` entity per
 * tenant. The editor identifies it only by type (no stable id), so we
 * pick the first match returned by the search endpoint.
 *
 * Parsing is intentionally defensive: a malformed `site_fallbacks`
 * JSON string logs a warning and degrades to "no fallbacks" instead of
 * exploding the render path.
 */
@injectable('EmporixCmsSettingsApi', 'Singleton')
class EmporixCmsSettingsApi implements IEmporixCmsSettingsApi {
  private readonly SETTINGS_ENTITY_TYPE = 'STOREFRONT_CMS_SETTINGS';
  private readonly SETTINGS_MIXIN_KEY = 'CMS_SETTINGS_DATA';

  constructor(
    @inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getSettings(): Promise<RawCmsSettings | null> {
    try {
      const result = await this.schemaApi.searchCustomEntities(
        this.SETTINGS_ENTITY_TYPE,
        { size: 1 },
        SETTINGS_TTL_SECONDS,
      );
      const entity = result.items?.[0];
      if (!entity) {
        return null;
      }

      const mixin = entity.mixins?.[this.SETTINGS_MIXIN_KEY] as Record<string, unknown> | undefined;
      if (!mixin) {
        return null;
      }

      return {
        site_fallbacks: this.parseSiteFallbacks(mixin.site_fallbacks),
      };
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        'Failed to load STOREFRONT_CMS_SETTINGS - falling back to no settings',
      );
      return null;
    }
  }

  private parseSiteFallbacks(raw: unknown): RawSiteFallbackEntry[] | undefined {
    if (raw == null) return undefined;

    let value: unknown = raw;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      try {
        value = JSON.parse(trimmed);
      } catch (error) {
        this.logger.warn(
          { err: error instanceof Error ? error.message : String(error) },
          'site_fallbacks is not valid JSON — ignoring',
        );
        return undefined;
      }
    }

    if (!Array.isArray(value)) {
      this.logger.warn({ type: typeof value }, 'site_fallbacks is not an array — ignoring');
      return undefined;
    }

    const entries: RawSiteFallbackEntry[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.site !== 'string' || !rec.site) continue;
      entries.push({
        site: rec.site,
        fallback_site: typeof rec.fallback_site === 'string' && rec.fallback_site ? rec.fallback_site : undefined,
        fallback_locale:
          typeof rec.fallback_locale === 'string' && rec.fallback_locale ? rec.fallback_locale : undefined,
      });
    }
    return entries;
  }
}

export default EmporixCmsSettingsApi;
