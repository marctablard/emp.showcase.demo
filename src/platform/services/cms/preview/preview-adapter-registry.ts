import 'server-only';
import { resolveCmsProvider } from '../CmsProviderResolver';
import type { CmsPreviewAdapter } from './CmsPreviewAdapter';

/**
 * NODE-only preview-adapter registry (EMP-15 §2).
 *
 * Static dispatch over the real `CmsProviderId` union resolved by
 * `resolveCmsProvider(env)`:
 *   - `'storyblok'` → the DI-resolved `StoryblokPreviewAdapter`
 *     (`CmsPreviewAdapter:storyblok`, a Singleton on the `@/platform/ssr`
 *     container).
 *   - `'local'` | `'none'` (and anything auto-resolving to `'none'`) → `null`,
 *     so the preview route answers `notFound()`.
 *
 * Unlike the detector registry this is `server-only`: it touches the SSR DI
 * container and, transitively, the provider SDK. It is never imported from the
 * Edge middleware.
 */
export async function getPreviewAdapter(env: NodeJS.ProcessEnv = process.env): Promise<CmsPreviewAdapter | null> {
  const provider = resolveCmsProvider(env);
  switch (provider) {
    case 'storyblok': {
      const container = (await import('@/platform/ssr')).default;
      const token = 'CmsPreviewAdapter:storyblok';
      if (!container.isBound(token)) {
        return null;
      }
      return container.get<CmsPreviewAdapter>(token);
    }
    case 'local':
    case 'none':
      return null;
    default: {
      // Exhaustiveness guard: adding a `CmsProviderId` makes this a tsc error,
      // forcing a deliberate preview-adapter decision for the new provider.
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}
