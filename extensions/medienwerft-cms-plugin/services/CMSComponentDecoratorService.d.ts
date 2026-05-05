import type { CMSComponent } from '@/platform/services/model/cms';

/**
 * Request-scoped context passed into every decorator invocation.
 *
 * The context intentionally carries only primitive information; decorator
 * implementations should reach for any additional platform services through
 * their own DI constructor injection.
 */
export interface CMSComponentDecoratorContext {
  /** Site code the page is being rendered for. */
  site: string;
  /** Locale the page is being rendered for. */
  locale: string;
}

/**
 * A type-specific enrichment function.
 *
 * Receives a CMS component (raw, as it comes back from the CMS) plus the
 * request context, and returns a partial **props** object whose entries will
 * be shallow-merged into `component.props` before the component is forwarded
 * to the renderer. Top-level component fields (`id`, `type`, …) are never
 * touched.
 *
 * Decorators must be side-effect free and SSR-compatible — they are executed
 * during `getPage` resolution, i.e. on the server, inside the request's DI
 * scope.
 */
export type CMSComponentDecorator = (
  component: CMSComponent,
  ctx: CMSComponentDecoratorContext,
) => Promise<Record<string, unknown>>;

/**
 * Service responsible for enriching CMS components with data that must be
 * resolved server-side (e.g. category trees, product details).
 *
 * The concrete implementation lives in the storefront so it can depend on
 * storefront-specific services via DI; the plugin only depends on this
 * abstraction.
 */
export interface CMSComponentDecoratorService {
  /**
   * Produce a new component with any type-specific extra props merged in.
   * When no decorator is registered for the component's type, the component
   * is returned unchanged.
   */
  decorate(component: CMSComponent, ctx: CMSComponentDecoratorContext): Promise<CMSComponent>;
}
