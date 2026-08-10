/**
 * Dual naming for Storyblok / CMS env keys (SHOW-323 legacy compat).
 *
 * Prefer server-only `NEXT_STORYBLOK_*` / `NEXT_CMS_*` when set (non-empty after
 * trim); otherwise fall back to legacy `NEXT_PUBLIC_STORYBLOK_*` /
 * `NEXT_PUBLIC_CMS_*`.
 *
 * This module is intentionally free of `server-only` so Tier-1 healthcheck /
 * Jest bootstrap can import it via a relative path. Call sites that must stay
 * server-bound should import the re-exports from `@/lib/server/storyblok-env`
 * instead (adds the `server-only` boundary).
 *
 * Legacy `NEXT_PUBLIC_*` keys are read via dynamic `env[key]` so ESLint
 * `no-restricted-syntax` (literal `process.env.NEXT_PUBLIC_STORYBLOK_*`) stays
 * enforced everywhere except this compatibility shim.
 */

export const STORYBLOK_ENV_SUFFIXES = ['ACCESS_TOKEN', 'SPACE_ID', 'MULTI_SITE', 'ACCESS_PREVIEW'] as const;

export type StoryblokEnvSuffix = (typeof STORYBLOK_ENV_SUFFIXES)[number];

/** CMS keys renamed from `NEXT_PUBLIC_CMS_*` → `NEXT_CMS_*` in SHOW-323. */
export const CMS_ENV_SUFFIXES = [
  'PROVIDER',
  'FALLBACK_PROVIDER',
  'LOCAL_DEFAULT_SITE',
  'PAGE_CACHE_TTL_MS',
  'LAYOUT_CACHE_TTL_MS',
] as const;

export type CmsEnvSuffix = (typeof CMS_ENV_SUFFIXES)[number];

function trimOrUndefined(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveDualEnv(preferredKey: string, legacyKey: string, env: NodeJS.ProcessEnv): string | undefined {
  const preferred = trimOrUndefined(env[preferredKey]);
  if (preferred !== undefined) {
    return preferred;
  }
  // Legacy SHOW-323 compat: allow NEXT_PUBLIC_* until deploy envs migrate.
  return trimOrUndefined(env[legacyKey]);
}

/**
 * Resolve a Storyblok config value: `NEXT_STORYBLOK_<name>` then
 * `NEXT_PUBLIC_STORYBLOK_<name>`.
 */
export function getStoryblokEnv(name: StoryblokEnvSuffix, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return resolveDualEnv(`NEXT_STORYBLOK_${name}`, `NEXT_PUBLIC_STORYBLOK_${name}`, env);
}

/**
 * Resolve a CMS config value: `NEXT_CMS_<name>` then `NEXT_PUBLIC_CMS_<name>`.
 */
export function getCmsEnv(name: CmsEnvSuffix, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return resolveDualEnv(`NEXT_CMS_${name}`, `NEXT_PUBLIC_CMS_${name}`, env);
}
