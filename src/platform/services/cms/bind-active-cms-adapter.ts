import type { Container } from 'inversify';
import 'server-only';
import { getPublicCmsLocalDefaultSite } from '@/lib/common/public-default-env';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CmsAdapter } from './CmsAdapter';
import { resolveCmsFallbackProvider, resolveCmsProvider } from './CmsProviderResolver';
import { FallbackCmsAdapter } from './impl/FallbackCmsAdapter';

/**
 * Binds the active `CmsAdapter` alias on `container`, driven by env.
 *
 * Single source of truth for the "which adapter does `CmsAdapter` resolve to"
 * decision, shared by the two server-side wiring sites that both need it
 * (EMP-16 Phase G):
 *  - `instrumentation.ts` (server + ssr containers at boot), and
 *  - `get-cms-service.ts` (the render-graph lazy-bind safety net — the
 *    Turbopack module-graph split means the boot-time binding can be invisible
 *    to the render-graph container; see ADR 0001).
 *
 * Both call this helper so the composite-fallback wrap can never be lost on
 * one graph but present on the other.
 *
 * Decision:
 *  1. Resolve the primary provider; if its target isn't bound on this
 *     container, degrade the primary to `CmsAdapter:none` (NullCmsAdapter)
 *     so the app still boots on a partially-configured container.
 *  2. Resolve the optional fallback source. When present AND its target is
 *     bound, wrap the primary in a `FallbackCmsAdapter` composite (bound as a
 *     constant value, since it needs constructor args that are not DI
 *     aliases). Otherwise the composite layer is transparently absent and the
 *     primary alias binds directly.
 *
 * The (re)bind is idempotent: an existing `CmsAdapter` binding is unbound
 * first.
 *
 * `import 'server-only'`: both callers are server-side (the `nodejs` runtime
 * branch of `instrumentation.ts` and the already-`server-only`
 * `get-cms-service.ts`). This must never reach a client bundle.
 */
export function bindActiveCmsAdapter(container: Container, env: NodeJS.ProcessEnv = process.env): void {
  const primaryTarget = `CmsAdapter:${resolveCmsProvider(env)}`;
  const effectivePrimaryTarget = container.isBound(primaryTarget) ? primaryTarget : 'CmsAdapter:none';

  const fallbackProvider = resolveCmsFallbackProvider(env);
  const fallbackTarget = fallbackProvider ? `CmsAdapter:${fallbackProvider}` : null;
  const useComposite = fallbackTarget !== null && container.isBound(fallbackTarget);

  const logger = container.isBound('LoggerService') ? container.get<LoggerService>('LoggerService') : undefined;

  if (effectivePrimaryTarget !== primaryTarget) {
    logger?.warn(
      { primaryTarget, fallback: effectivePrimaryTarget },
      'CMS adapter target not bound — falling back to CmsAdapter:none',
    );
  }

  if (container.isBound('CmsAdapter')) {
    container.unbind('CmsAdapter');
  }

  if (useComposite) {
    const primary = container.get<CmsAdapter>(effectivePrimaryTarget);
    const fallbackSource = container.get<CmsAdapter>(fallbackTarget);
    const fallbackSite = getPublicCmsLocalDefaultSite();
    logger?.info(
      { primaryTarget: effectivePrimaryTarget, fallbackTarget, fallbackSite },
      'Wrapping CMS adapter in default-content fallback composite',
    );
    container.bind('CmsAdapter').toConstantValue(new FallbackCmsAdapter(primary, fallbackSource, fallbackSite, logger));
    return;
  }

  container.bind('CmsAdapter').toService(effectivePrimaryTarget);
}
