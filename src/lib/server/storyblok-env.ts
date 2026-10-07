import 'server-only';

/**
 * Server-bound re-export of Storyblok/CMS dual-env resolution.
 *
 * Prefer importing from here (not `@/lib/common/cms-dual-env`) in API routes,
 * server actions, integrations, and services so the `server-only` boundary
 * prevents accidental client-bundle imports of token resolution.
 *
 * Pure implementation: {@link ../common/cms-dual-env.ts}.
 */
export {
  CMS_ENV_SUFFIXES,
  STORYBLOK_ENV_SUFFIXES,
  getCmsEnv,
  getStoryblokEnv,
  type CmsEnvSuffix,
  type StoryblokEnvSuffix,
} from '../common/cms-dual-env';
