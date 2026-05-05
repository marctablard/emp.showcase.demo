import ssr from '@/platform/ssr';
import type { CMSSettingsService, CMSSiteFallback } from '../services/CMSSettingsService';

/**
 * DI-bound accessor for the CMS Settings service. Kept as its own
 * module so the Settings service / API can stay free of any
 * `@/platform/ssr` import — they are themselves part of the `ssr`
 * container, and a top-level import there creates a circular module
 * graph that Turbopack resolves to a TDZ on the container's default
 * export.
 *
 * Only non-DI callers (components, fetchers) should import this file.
 *
 * Returns `undefined` when the service is not bound (e.g. the
 * extension was dropped into a host storefront that has not yet
 * implemented / generated DI for settings). Callers then fall back to
 * their previous hard-coded defaults without breaking.
 */
export async function getSiteFallback(site: string): Promise<CMSSiteFallback | undefined> {
  if (!ssr.isBound('CMSSettingsService')) return undefined;
  const service = ssr.get<CMSSettingsService>('CMSSettingsService');
  return service.getSiteFallback(site);
}
