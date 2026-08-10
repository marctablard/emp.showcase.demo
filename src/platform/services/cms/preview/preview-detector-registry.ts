import { storyblokPreviewDetector } from '@/platform/integrations/storyblok/cms/preview/storyblok-preview-detection';
import { resolveCmsProvider } from '../CmsProviderResolver';
import type { CmsPreviewDetector } from './CmsPreviewDetector';

/**
 * EDGE-SAFE preview-detector registry (EMP-15 §2).
 *
 * Static dispatch over the real `CmsProviderId` union resolved by
 * `resolveCmsProvider(env)`:
 *   - `'storyblok'` → the pure `storyblokPreviewDetector` (id `'storyblok'`).
 *   - `'local'` | `'none'` (and any value auto-resolving to `'none'`, such as
 *     an unknown `'mock'`) → the shared NEVER_PREVIEW detector (id `'none'`,
 *     always `false`).
 *
 * This module MUST stay legal in the Edge bundle: it statically imports ONLY
 * the pure detection module — no SDK, no `server-only`.
 */

/** Single source of truth for the preview route prefix. */
export const PREVIEW_ROUTE_PREFIX = '/preview';

/** Shared never-detector for non-Storyblok providers. */
const NEVER_PREVIEW: CmsPreviewDetector = {
  id: 'none',
  isPreviewRequest: () => false,
};

export function getPreviewDetector(env: NodeJS.ProcessEnv = process.env): CmsPreviewDetector {
  const provider = resolveCmsProvider(env);
  switch (provider) {
    case 'storyblok':
      return storyblokPreviewDetector;
    case 'local':
    case 'none':
      return NEVER_PREVIEW;
    default: {
      // Exhaustiveness guard: adding a `CmsProviderId` makes this a tsc error,
      // forcing a deliberate preview-detection decision for the new provider.
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}
