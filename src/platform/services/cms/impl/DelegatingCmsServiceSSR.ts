import type { ComponentType, HTMLAttributes } from 'react';
import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type {
  CMSComponent,
  CMSLayout,
  CMSNavigation,
  CMSNoResult,
  CMSPage,
  WebhookEvent,
  WebhookResult,
} from '../../model/cms';
import type { CMSService } from '../CMSService';
import type { CmsAdapter } from '../CmsAdapter';
import {
  getCachedLayout,
  getCachedPage,
  invalidateLayout,
  invalidatePage,
  setCachedLayout,
  setCachedPage,
} from '../cms-cache';
import { isCmsNoResult } from '../cms-no-result';

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

  async getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult> {
    const cached = getCachedPage(slug, locale, site);
    if (cached) {
      return cached;
    }
    const result = await this.adapter.getPage(slug, locale, site);
    // `{ notfound: true }` is never cached: a missing page is cheap to re-resolve
    // and caching it would mask content that gets published moments later.
    if (!isCmsNoResult(result)) {
      setCachedPage(slug, locale, site, result);
    }
    return result;
  }

  async getLayout(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult> {
    const cached = getCachedLayout(layoutId, locale, site);
    if (cached) {
      return cached;
    }
    const result = await this.adapter.getLayout(layoutId, locale, site);
    if (!isCmsNoResult(result)) {
      setCachedLayout(layoutId, locale, site, result);
    }
    return result;
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

  /**
   * Webhook entry point, surfaced only when the active adapter supports
   * webhooks. Resolution order:
   *  1. the adapter fully owns the request (`handleWebhook`), or
   *  2. the facade orchestrates the default flow from the adapter's
   *     `validateWebhookSignature` + `mapWebhookPayload` primitives, keeping
   *     cache invalidation in the service layer (the adapter stays
   *     cache-agnostic), or
   *  3. neither — `undefined`, which the route maps to `405`.
   */
  get handleWebhook(): ((request: Request) => Promise<WebhookResult>) | undefined {
    const adapter = this.adapter;
    if (adapter.handleWebhook) {
      return adapter.handleWebhook.bind(adapter);
    }
    if (adapter.validateWebhookSignature && adapter.mapWebhookPayload) {
      // HMAC-based adapters require a configured signing secret. The check
      // lives here — not in the generic route handler — so that adapters
      // without HMAC validation are not blocked by a missing provider-specific
      // secret. Returning a 503 handler (not `undefined`) keeps the route's
      // 405 / 503 distinction clean: 405 = no webhook surface, 503 = disabled.
      if (!process.env.NEXT_CMS_WEBHOOK_SECRET) {
        return () => Promise.resolve({ status: 503, body: { error: 'CMS webhook disabled' } });
      }
      return (request: Request) => this.dispatchWebhook(request, adapter);
    }
    return undefined;
  }

  private async dispatchWebhook(request: Request, adapter: CmsAdapter): Promise<WebhookResult> {
    const rawBody = await request.text();
    if (!adapter.validateWebhookSignature!(request.headers, rawBody)) {
      return { status: 401, body: { error: 'Invalid signature' } };
    }
    let payload: unknown;
    try {
      payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      return { status: 400, body: { error: 'Invalid payload' } };
    }
    const events = adapter.mapWebhookPayload!(request.headers, payload) ?? [];
    for (const event of events) {
      this.invalidate(event);
    }
    return { status: 200, body: { invalidated: events.length } };
  }

  private invalidate(event: WebhookEvent): void {
    if (event.kind === 'page') {
      invalidatePage(event.slug, event.locale, event.site);
    } else if (event.kind === 'layout') {
      invalidateLayout(event.layoutId, event.locale, event.site);
    }
    // `navigation` events carry no cache key in the current scope (only
    // page-cache and layout-cache exist) — intentionally a no-op until a
    // navigation cache is introduced.
  }
}

export default DelegatingCmsServiceSSR;
