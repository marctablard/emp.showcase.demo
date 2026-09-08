import 'server-only';
import { getCmsEnv } from '@/lib/server/storyblok-env';

/**
 * Server-only defaults for the local-JSON CMS adapter.
 *
 * Lives under `src/lib/server/` (not `src/lib/common/`) because every consumer
 * is server-only (`LocalJsonCmsAdapter`, `bind-active-cms-adapter`). Keeping
 * the helper here makes the server-only constraint explicit at the module
 * boundary and prevents the value from ever being shaped as a browser-inlined
 * `NEXT_PUBLIC_*` default.
 *
 * Resolves `NEXT_CMS_LOCAL_DEFAULT_SITE`, with legacy
 * `NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` fallback (dual naming).
 */
export function getCmsLocalDefaultSite(): string {
  return getCmsEnv('LOCAL_DEFAULT_SITE') ?? '_default_';
}
