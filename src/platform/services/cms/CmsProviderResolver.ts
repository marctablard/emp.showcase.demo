/**
 * Resolves the active CMS provider id from runtime environment variables.
 *
 * Resolution rules:
 * - When `NEXT_PUBLIC_CMS_PROVIDER` is explicitly set to one of the known
 *   provider ids (after trimming), that value wins.
 * - Otherwise auto-resolve: if `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` is
 *   non-empty (after trimming), return `'storyblok'`. Else return `'none'`.
 * - Unknown / whitespace-only `NEXT_PUBLIC_CMS_PROVIDER` values are treated
 *   as unset (fall through to auto-resolution).
 *
 * The resolved id is used by `instrumentation.ts` to alias-bind
 * `CmsAdapter` -> `CmsAdapter:<id>` in the DI container.
 *
 * Adding a new provider:
 * - Append its id to `CMS_PROVIDER_IDS` below.
 * - Implement and `@injectable('CmsAdapter:<id>', 'Singleton')`-bind the
 *   adapter under `src/platform/integrations/<id>/cms/...`.
 * The derived `CmsProviderId` union and the runtime guard `isCmsProviderId`
 * pick up the new value automatically.
 */

/**
 * Canonical list of CMS provider ids understood by this codebase.
 *
 * Declared as a `readonly` tuple so the derived `CmsProviderId` union stays
 * in lock-step with the runtime guard `isCmsProviderId`. Treat as the
 * single source of truth.
 */
export const CMS_PROVIDER_IDS = ['storyblok', 'local', 'none'] as const;

export type CmsProviderId = (typeof CMS_PROVIDER_IDS)[number];

function isCmsProviderId(value: string): value is CmsProviderId {
  return (CMS_PROVIDER_IDS as readonly string[]).includes(value);
}

export function resolveCmsProvider(env: NodeJS.ProcessEnv = process.env): CmsProviderId {
  const explicit = env.NEXT_PUBLIC_CMS_PROVIDER?.trim() ?? '';
  if (isCmsProviderId(explicit)) {
    return explicit;
  }
  if (env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim()) {
    return 'storyblok';
  }
  return 'none';
}
