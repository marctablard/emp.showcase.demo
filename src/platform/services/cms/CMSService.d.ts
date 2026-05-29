import type { ComponentType, HTMLAttributes } from 'react';
import type { CMSComponent, CMSLayout, CMSNavigation, CMSNoResult, CMSPage, WebhookResult } from '../model/cms';

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
  /**
   * Present iff the active adapter supports webhooks (either directly via
   * `CmsAdapter.handleWebhook`, or via the `validateWebhookSignature` +
   * `mapWebhookPayload` primitives that the facade orchestrates). `undefined`
   * for providers without a webhook surface — the route maps that to `405`.
   */
  readonly handleWebhook?: (request: Request) => Promise<WebhookResult>;
}
