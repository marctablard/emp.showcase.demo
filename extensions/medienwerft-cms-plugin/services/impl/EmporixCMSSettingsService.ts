import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { EmporixCmsSettingsApi } from '../../integrations/EmporixCmsSettingsApi';
import type { CMSSiteFallback, CMSSettingsService as ICMSSettingsService } from '../CMSSettingsService';

/**
 * Resolves per-site fallbacks from the CMS settings entity.
 *
 * Cross-request caching is delegated to `EmporixCmsSettingsApi`, which
 * issues its Emporix read with `next: { revalidate: 300 }`. That gives
 * us serverless-safe deduplication without an `unstable_cache` wrapper
 * (and without manual tag invalidation): editors publish, shoppers see
 * the change once the per-fetch TTL expires.
 *
 * The service stays intentionally tolerant — a missing settings entity
 * or an entry without a fallback row resolves to `undefined`, which
 * callers treat as "no fallback".
 */
@injectable('EmporixCMSSettingsService', 'Singleton')
export class EmporixCMSSettingsService implements ICMSSettingsService {
  constructor(
    @inject('EmporixCmsSettingsApi') private settingsApi: EmporixCmsSettingsApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getSiteFallback(site: string): Promise<CMSSiteFallback | undefined> {
    if (!site) return undefined;
    try {
      return await this.resolveFallback(site);
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : String(error), site },
        'Failed to resolve CMS site fallback — degrading to undefined',
      );
      return undefined;
    }
  }

  private async resolveFallback(site: string): Promise<CMSSiteFallback | undefined> {
    const settings = await this.settingsApi.getSettings();
    const entry = settings?.site_fallbacks?.find((row) => row.site?.toLowerCase() === site.toLowerCase());
    if (!entry) return undefined;
    const fallback: CMSSiteFallback = {
      site: entry.fallback_site || undefined,
      locale: entry.fallback_locale || undefined,
    };
    if (!fallback.site && !fallback.locale) return undefined;
    return fallback;
  }
}

export default EmporixCMSSettingsService;
