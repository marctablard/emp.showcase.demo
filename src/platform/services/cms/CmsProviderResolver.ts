// Relative import of the pure dual-env helpers — this module is shared by
// Edge middleware (`preview-detector-registry`) and must NOT pull in
// `server-only` via `@/lib/server/storyblok-env`. Server-only call sites that
// only need env helpers should import `@/lib/server/storyblok-env` directly.
import { getCmsEnv, getStoryblokEnv } from '../../../lib/common/cms-dual-env';

/**
 * Resolves the active CMS provider id from runtime environment variables.
 *
 * Resolution rules:
 * - When `NEXT_CMS_PROVIDER` (or legacy `NEXT_PUBLIC_CMS_PROVIDER`) is
 *   explicitly set to one of the known provider ids (after trimming), that
 *   value wins.
 * - Otherwise auto-resolve: if `NEXT_STORYBLOK_ACCESS_TOKEN` (or legacy
 *   `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`) is non-empty (after trimming),
 *   return `'storyblok'`. Else return `'none'`.
 * - Unknown / whitespace-only provider values are treated as unset
 *   (fall through to auto-resolution).
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
  const explicit = getCmsEnv('PROVIDER', env) ?? '';
  if (isCmsProviderId(explicit)) {
    return explicit;
  }
  if (getStoryblokEnv('ACCESS_TOKEN', env)) {
    return 'storyblok';
  }
  return 'none';
}

/**
 * Resolves the default-content fallback source provider from
 * `NEXT_CMS_FALLBACK_PROVIDER` (or legacy `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER`),
 * or `null` when no composite fallback layer should be wired (EMP-16 Phase G).
 *
 * Resolution rules:
 * - Unset / empty / whitespace-only → `null` (composite layer is transparently
 *   absent — the active primary binds directly).
 * - `'mock'` is a backwards-compat alias for `'local'` (the local-JSON adapter
 *   that serves the version-controlled `_default_` showcase tree).
 * - A known provider id (`'local'`, ...) resolves to itself.
 * - A value equal to the resolved active primary provider → `null`
 *   (self-wrap guard: a provider must never fall back onto itself).
 * - Any unknown value → `null` (strict: unknown is NOT auto-resolved to a
 *   default — an opt-in fallback must name a real source).
 *
 * The resolved id is used by `bindActiveCmsAdapter` to wrap the active
 * `CmsAdapter` in a `FallbackCmsAdapter` composite.
 */
export function resolveCmsFallbackProvider(env: NodeJS.ProcessEnv = process.env): CmsProviderId | null {
  const raw = getCmsEnv('FALLBACK_PROVIDER', env) ?? '';
  if (!raw) {
    return null;
  }

  const resolved = raw === 'mock' ? 'local' : raw;
  if (!isCmsProviderId(resolved)) {
    return null;
  }

  // Self-wrap guard: a fallback that equals the active primary is pointless
  // and would double the same adapter — treat as "no fallback".
  if (resolved === resolveCmsProvider(env)) {
    return null;
  }

  return resolved;
}
