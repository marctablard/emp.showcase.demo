import 'server-only';
import type { CMSService } from './CMSService';
import { resolveCmsProvider } from './CmsProviderResolver';

/**
 * SSR helper: returns the active `CMSService` after guaranteeing that the
 * `CmsAdapter` alias on the resolved-at-call-site container points at the
 * env-resolved provider impl.
 *
 * Why this exists (and why we can't just trust `instrumentation.ts`):
 * Next.js / Turbopack can evaluate the `@/platform/ssr` module under separate
 * module graphs (server-instrumentation graph vs. Server-Component render
 * graph). When that happens the alias bound by `instrumentation.ts` lives on
 * the instrumentation-graph container and is invisible to the render-graph
 * container. The render-time `container.get('CMSService')` then resolves a
 * fresh `DelegatingCmsServiceSSR` singleton whose `@inject('CmsAdapter')`
 * finds nothing bound, and Inversify throws
 * `No bindings found for service: "CmsAdapter"`.
 *
 * Binding the alias lazily at the resolve site is cheap (one `isBound` check
 * plus at most one rebind per container instance, since the resolved
 * `CmsAdapter` is itself a Singleton) and makes the render pipeline resilient
 * to whichever container instance Turbopack hands us. The `instrumentation.ts`
 * alias-binding is kept as the server-container / Route-Handler path; this
 * helper is the render-path safety net. See ADR 0001.
 *
 * When the env-resolved target (`CmsAdapter:<id>`) is itself not bound on this
 * container instance, the helper falls back to `CmsAdapter:none`
 * (`NullCmsAdapter`) so the app still boots on a partially-configured
 * container.
 *
 * This module is `import 'server-only'` because it touches the SSR container,
 * so it must never be called from a Client Component or from a module that
 * ends up in the client bundle.
 *
 * Generalizes to every programmatic DI alias: the Turbopack module-graph-split
 * caveat applies to ANY programmatic alias resolved on the render-graph
 * container, not just CMS. A future feature that binds another programmatic
 * alias in `instrumentation.ts` MUST ship an equivalent lazy-bind helper that
 * checks `isBound(alias)` and rebinds idempotently at the resolve site.
 */
export async function getCmsService(): Promise<CMSService> {
  const container = (await import('@/platform/ssr')).default;

  if (!container.isBound('CmsAdapter')) {
    const target = `CmsAdapter:${resolveCmsProvider(process.env)}`;
    container.bind('CmsAdapter').toService(container.isBound(target) ? target : 'CmsAdapter:none');
  }

  return container.get<CMSService>('CMSService');
}
