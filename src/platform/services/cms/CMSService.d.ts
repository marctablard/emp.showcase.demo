import type { ComponentType, HTMLAttributes } from 'react';
import type { CMSComponent, CMSLayout, CMSNavigation, CMSNoResult, CMSPage } from '../model/cms';

/**
 * Service for CMS-related operations.
 *
 * Single implementation: `DelegatingCmsServiceSSR`, which forwards every
 * call to the active `CmsAdapter` plugin (chosen at bootstrap by
 * `CmsProviderResolver`).
 */
export interface CMSService {
  readonly providerId: string;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getLayout(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  getEditableProps(component: CMSComponent): HTMLAttributes<HTMLElement>;
  readonly BridgeScript: ComponentType | null;
}
