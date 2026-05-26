import type { ComponentType, HTMLAttributes } from 'react';
import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { CMSComponent, CMSNavigation, CMSNoResult, CMSPage } from '../../model/cms';
import type { CMSService } from '../CMSService';
import type { CmsAdapter } from '../CmsAdapter';

/**
 * Sole `CMSService` implementation: a thin facade that delegates every
 * call to the active `CmsAdapter` plugin.
 *
 * The adapter is bound to the DI key `CmsAdapter` (aliased from
 * `CmsAdapter:<id>` by `instrumentation.ts` using `CmsProviderResolver`).
 *
 * Optional-surface fallbacks:
 * - `getEditableProps` -> empty object `{}` when the adapter omits it.
 * - `BridgeScript`     -> `null` (not `undefined`) when the adapter omits it.
 */
@injectable('CMSService', 'Singleton')
export class DelegatingCmsServiceSSR implements CMSService {
  constructor(@inject('CmsAdapter') private readonly adapter: CmsAdapter) {}

  get providerId(): string {
    return this.adapter.id;
  }

  hasContent(): boolean {
    return this.adapter.hasContent();
  }

  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult> {
    return this.adapter.getPage(slug, locale, site);
  }

  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult> {
    return this.adapter.getNavigation(locale, site);
  }

  getEditableProps(component: CMSComponent): HTMLAttributes<HTMLElement> {
    return this.adapter.getEditableProps?.(component) ?? {};
  }

  get BridgeScript(): ComponentType | null {
    return this.adapter.BridgeScript ?? null;
  }
}

export default DelegatingCmsServiceSSR;
