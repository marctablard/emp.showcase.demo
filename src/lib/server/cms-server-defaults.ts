import 'server-only';

/**
 * Server-only defaults for the local-JSON CMS adapter.
 *
 * Lives under `src/lib/server/` (not `src/lib/common/`) because every consumer
 * is server-only (`LocalJsonCmsAdapter`, `bind-active-cms-adapter`). Keeping
 * the helper here makes the server-only constraint explicit at the module
 * boundary and prevents the value from ever being shaped as a browser-inlined
 * `NEXT_PUBLIC_*` default.
 *
 * The backing env var is `NEXT_CMS_LOCAL_DEFAULT_SITE` (no `NEXT_PUBLIC_`
 * prefix — never inlined into the client bundle).
 */
export function getCmsLocalDefaultSite(): string {
  const raw = process.env.NEXT_CMS_LOCAL_DEFAULT_SITE;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : '_default_';
}
