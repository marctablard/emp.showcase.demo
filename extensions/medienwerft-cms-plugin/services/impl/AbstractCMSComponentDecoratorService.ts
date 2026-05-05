import type { CMSComponent } from '@/platform/services/model/cms';
import type {
  CMSComponentDecorator,
  CMSComponentDecoratorContext,
  CMSComponentDecoratorService,
} from '../CMSComponentDecoratorService';

/**
 * Base implementation for {@link CMSComponentDecoratorService} that dispatches
 * to per-type decorator functions held in a registry.
 *
 * Concrete subclasses build the registry (usually via DI-injected helpers)
 * and pass it to `super()`. This class owns the merge semantics and the
 * per-component error handling so individual decorators can stay simple.
 */
export abstract class AbstractCMSComponentDecoratorService implements CMSComponentDecoratorService {
  /**
   * @param decoratorMap Record of component `type` → decorator function.
   */
  constructor(private readonly decoratorMap: Record<string, CMSComponentDecorator> = {}) {}

  async decorate(component: CMSComponent, ctx: CMSComponentDecoratorContext): Promise<CMSComponent> {
    const decorator = this.decoratorMap[component.type];
    if (!decorator) return component;

    try {
      const extras = await decorator(component, ctx);
      // Merge into `props` (not the top-level component) because the CMS
      // renderer forwards only `component.props` to each component's prop
      // mapper — anything placed at the top level would never reach React.
      return {
        ...component,
        props: { ...(component.props ?? {}), ...extras },
      };
    } catch (err) {
      this.onDecorationError(component, ctx, err);
      return component;
    }
  }

  /**
   * Hook for subclasses to observe decoration failures (e.g. for logging).
   * Default implementation is a no-op so failures silently fall back to the
   * undecorated component.
   */
  protected onDecorationError(_component: CMSComponent, _ctx: CMSComponentDecoratorContext, _err: unknown): void {
    // subclasses may override
  }
}
