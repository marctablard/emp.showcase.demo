import { cache } from 'react';
import ssr from '@/platform/ssr';
import type { CMSThemeTokenManifestService, ThemeTokenManifest } from '../services/CMSThemeTokenManifestService';

/**
 * Resolve the CMS theme-token manifest for a site during SSR.
 *
 * Wrapped in React's request-scoped `cache()` so the same render tree
 * builds the manifest at most once even if multiple components ask
 * for it (the inline `<style>` server component, the live bridge prop,
 * future RSC consumers, …).
 *
 * Returns `null` when no implementation is registered, e.g. the
 * extension is dropped into a host that hasn't yet bound a concrete
 * `CMSThemeTokenManifestService`. The live bridge then answers
 * `REQUEST_THEME_TOKENS` with an empty manifest, which the editor
 * surfaces as "no manifest available — generic UI".
 *
 * Lives in a separate file from the service definition because the
 * service file is consumed by DI registration code; this module imports
 * `@/platform/ssr` and is therefore strictly a render-time helper.
 */
export const fetchCMSThemeTokenManifest = cache(async (site: string): Promise<ThemeTokenManifest | null> => {
  if (!ssr.isBound('CMSThemeTokenManifestService')) return null;
  const service = ssr.get<CMSThemeTokenManifestService>('CMSThemeTokenManifestService');
  return service.getManifest(site);
});
