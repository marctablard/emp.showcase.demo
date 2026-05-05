import ssr from '@/platform/ssr';
import type { CMSTheme, CMSThemeService, GetThemeOptions } from '../services/CMSThemeService';

/**
 * DI-bound accessor for the CMS Theme service. Lives in a separate
 * file from `lib/cms-theme.ts` because that file (the entity-id
 * helper) is imported by the Theme service and Theme API — both
 * registered in the `ssr` container. Importing `@/platform/ssr` from
 * there would create a circular module graph that Turbopack resolves
 * to a TDZ on the container's default export.
 *
 * Only non-DI callers (components, fetchers) should import this file.
 *
 * Returns `null` when no `CMSThemeService` is bound (e.g. the
 * extension ships the interface but the host has not registered the
 * implementation). Callers should treat `null` as "no overrides".
 */
export async function getThemeForSite(site: string, options?: GetThemeOptions): Promise<CMSTheme | null> {
  if (!ssr.isBound('CMSThemeService')) return null;
  const service = ssr.get<CMSThemeService>('CMSThemeService');
  return service.getThemeForSite(site, options);
}
